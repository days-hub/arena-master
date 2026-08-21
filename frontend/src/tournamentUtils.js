function transformTournamentData(matchesData) {
    const transformedData = matchesData.map((match) => ({
      id: match.match_id,
      name: `${match.team_a} vs ${match.team_b}`,
      nextMatchId: null, // Initialize as null
      startTime: null,
      state: 'SCHEDULED',
      participants: [
        {
          id: match.team_a,
          resultText: null,
          isWinner: false,
          status: null,
          name: match.team_a,
        },
        {
          id: match.team_b,
          resultText: null,
          isWinner: false,
          status: null,
          name: match.team_b,
        },
      ],
    }));
  
    // Set the nextMatchId based on the tournament structure
    const numMatches = transformedData.length;
    const finalMatchId = numMatches + 1;
  
    for (let i = 0; i < numMatches; i += 2) {
      const match1 = transformedData[i];
      const match2 = transformedData[i + 1];
  
      if (match1 && match2) {
        match1.nextMatchId = finalMatchId;
        match2.nextMatchId = finalMatchId;
      }
    }
  
    // Add the final match
    transformedData.push({
      id: finalMatchId,
      name: 'Final',
      nextMatchId: null,
      startTime: null,
      state: 'SCHEDULED',
      participants: [
        {
          id: null,
          resultText: null,
          isWinner: false,
          status: null,
          name: 'TBD',
        },
        {
          id: null,
          resultText: null,
          isWinner: false,
          status: null,
          name: 'TBD',
        },
      ],
    });
  
    return transformedData;
  }

  // Transform the matches returned by /api/tournaments/by_name (the "participants"
  // shape, with round_number and winner) into the format @g-loot expects.
  //
  // It builds the COMPLETE single-elimination tree (including not-yet-played rounds as
  // TBD placeholders) so the bracket always has a single final and renders the same
  // whether a tournament is brand new or finished. Every node gets a synthetic string id
  // (`r<round>-<pos>`) so ids can never collide with each other or form a cycle — the
  // bug that made @g-loot recurse infinitely when ids were derived from the DB. It does
  // not mutate tournament data, so it's safe for view-only loads.
  function transformApiMatches(apiMatches) {
    if (!Array.isArray(apiMatches) || apiMatches.length === 0) return [];

    // Group real matches by round and order them by id (their position within the round).
    const byRound = {};
    apiMatches.forEach((m) => {
      const r = m.round_number || 1;
      (byRound[r] = byRound[r] || []).push(m);
    });
    Object.keys(byRound).forEach((r) =>
      byRound[r].sort((a, b) => (a.id || 0) - (b.id || 0))
    );

    const presentRounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
    // Size the tree from the deepest round backwards: round r holds 2^(totalRounds - r)
    // slots, so the depth has to be big enough for every round that actually exists.
    // Deriving it from the opening round alone assumed a clean halving, which silently
    // dropped the real final whenever the field was not a power of two (byes, uneven
    // opening participation). For power-of-two brackets this produces the same tree.
    const totalRounds = presentRounds.reduce(
      (depth, round) => Math.max(depth, round + Math.ceil(Math.log2(byRound[round].length))),
      1
    );
    const idFor = (round, pos) => `r${round}-${pos}`;

    const buildParticipant = (p, fallbackId) => ({
      id: p && p.id != null ? p.id : fallbackId,
      name: (p && p.name) || 'TBD',
      isWinner: !!(p && p.isWinner),
      status: (p && p.status) || null,
      resultText: p && p.resultText != null ? p.resultText : null,
    });

    const nodes = [];
    for (let round = 1; round <= totalRounds; round += 1) {
      const matchesInRound = 2 ** (totalRounds - round);
      const realMatches = byRound[round] || [];
      const isFinal = round === totalRounds;
      for (let pos = 0; pos < matchesInRound; pos += 1) {
        const source = realMatches[pos];
        const ps = source ? source.participants || [] : [];
        nodes.push({
          id: idFor(round, pos),
          // Real db match id behind this node (null for TBD placeholders) —
          // lets the bracket view record results for clicked matches.
          dbMatchId: source ? source.id : null,
          // Used by the library's column headers ("Round 1", "Semi-final",
          // "Final"); without it early rounds render as "Round undefined".
          tournamentRoundText: String(round),
          name: isFinal ? 'Final' : `Round ${round} - Match ${pos + 1}`,
          nextMatchId: isFinal ? null : idFor(round + 1, Math.floor(pos / 2)),
          startTime: (source && source.startTime) || '',
          state: source && source.winner
            ? (source.state === 'FORFEIT' ? 'FORFEIT' : 'DONE')
            : (source && source.state) || 'SCHEDULED',
          participants: [
            buildParticipant(ps[0], `${idFor(round, pos)}-a`),
            buildParticipant(ps[1], `${idFor(round, pos)}-b`),
          ],
        });
      }
    }

    // Surface an advancing team in the next-round placeholder immediately.
    // The backend creates the real next-round match once the whole current
    // round is decided, but the bracket should still show each winner moving
    // forward as soon as their own match finishes.
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    nodes.forEach((node) => {
      if (!node.nextMatchId || node.state === 'SCHEDULED') return;
      const winner = node.participants.find((participant) => participant.isWinner);
      const destination = nodeById.get(node.nextMatchId);
      if (!winner || !destination || destination.dbMatchId) return;
      const sourcePosition = Number(node.id.split('-')[1]) || 0;
      destination.participants[sourcePosition % 2] = {
        ...winner,
        isWinner: false,
        resultText: null,
        status: 'ADVANCED',
      };
    });
    return nodes;
  }

  // Which round a bracket node belongs to, from the round text the transform stamps on
  // it, falling back to its synthetic `r<round>-<pos>` id.
  const roundOf = (match) => Number(match.tournamentRoundText || String(match.id).match(/^r(\d+)/)?.[1] || 1);

  // Walk the champion's route to the trophy using only bracket data: the matches the
  // champion actually won, linked by nextMatchId, with round information used solely to
  // anchor the end of the route. Never uses DOM geometry, and the chain itself is never
  // derived from round arithmetic, so byes, forfeits and uneven opening rounds all fall
  // out naturally — it simply starts wherever the champion first appears as a winner.
  //
  // Returns the matches in chronological order, the ids of the connectors between them
  // (keyed by their source match, the way the bracket renders edges) and a flat list of
  // reveal steps that alternates match → connector → match for the replay animation.
  function buildChampionPath(matches, championName) {
    const empty = { matchIds: [], connectorIds: [], steps: [] };
    if (!championName || !Array.isArray(matches) || matches.length === 0) return empty;

    const wonByChampion = new Map();
    const feedsInto = new Map();
    matches.forEach((match) => {
      if (!match) return;
      const won = (match.participants || []).some(
        (participant) => participant && participant.isWinner && participant.name === championName
      );
      if (won) wonByChampion.set(match.id, match);
      if (match.nextMatchId == null) return;
      if (!feedsInto.has(match.nextMatchId)) feedsInto.set(match.nextMatchId, []);
      feedsInto.get(match.nextMatchId).push(match);
    });
    if (wonByChampion.size === 0) return empty;

    // The route ends at the champion win that does not advance into another champion win.
    const deciders = [...wonByChampion.values()].filter(
      (match) => match.nextMatchId == null || !wonByChampion.has(match.nextMatchId)
    );
    if (deciders.length === 0) return empty;

    const walkBack = (decider) => {
      const chain = [];
      const seen = new Set();
      let current = decider;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.unshift(current);
        // A team can only ever win one of the two feeder matches, so more than one
        // candidate means the data is inconsistent — stop rather than guess.
        const feeders = (feedsInto.get(current.id) || [])
          .filter((match) => wonByChampion.has(match.id) && !seen.has(match.id));
        current = feeders.length === 1 ? feeders[0] : null;
      }
      return chain;
    };

    // The route has to end on the champion's last match, so rank candidates by round
    // first: a broken nextMatchId elsewhere in the bracket can otherwise leave a longer
    // early fragment looking more authoritative than the real final. Chain length only
    // breaks ties within the same round.
    const best = deciders
      .map((decider) => ({ round: roundOf(decider), chain: walkBack(decider) }))
      .reduce((leader, candidate) => {
        if (!leader) return candidate;
        if (candidate.round !== leader.round) return candidate.round > leader.round ? candidate : leader;
        return candidate.chain.length > leader.chain.length ? candidate : leader;
      }, null);
    const chain = best ? best.chain : [];
    if (chain.length === 0) return empty;

    const steps = [];
    chain.forEach((match, index) => {
      steps.push({ type: 'match', id: match.id });
      if (index < chain.length - 1) steps.push({ type: 'connector', id: match.id });
    });

    return {
      matchIds: chain.map((match) => match.id),
      connectorIds: chain.slice(0, -1).map((match) => match.id),
      steps,
    };
  }

  export { transformTournamentData, transformApiMatches, buildChampionPath, roundOf };
