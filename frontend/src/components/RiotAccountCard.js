import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CircularProgress, Divider, FormControl,
  InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import {
  AutorenewRounded, LinkOffRounded, LinkRounded, SportsEsportsRounded,
} from '@mui/icons-material';
import {
  fetchMyRiotAccount, fetchRiotStatus, getApiErrorMessage, linkRiotAccount,
  refreshRiotAccount, unlinkRiotAccount,
} from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import RankChip from './RankChip';

// Riot's platform routing values, with the labels players actually use.
const PLATFORMS = [
  ['na1', 'North America'], ['euw1', 'EU West'], ['eun1', 'EU Nordic & East'],
  ['kr', 'Korea'], ['br1', 'Brazil'], ['jp1', 'Japan'], ['la1', 'LAN'],
  ['la2', 'LAS'], ['oc1', 'Oceania'], ['tr1', 'Türkiye'], ['ru', 'Russia'],
  ['ph2', 'Philippines'], ['sg2', 'Singapore'], ['th2', 'Thailand'],
  ['tw2', 'Taiwan'], ['vn2', 'Vietnam'],
];

const RiotAccountCard = () => {
  const { isAuthenticated, signIn } = useAuth();
  const [enabled, setEnabled] = useState(null); // null = still checking
  const [account, setAccount] = useState(null);
  const [riotId, setRiotId] = useState('');
  const [platform, setPlatform] = useState('na1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      const status = await fetchRiotStatus();
      setEnabled(Boolean(status.data?.enabled));
      if (!status.data?.enabled || !isAuthenticated) return;
      const mine = await fetchMyRiotAccount();
      // 204 means signed in but nothing linked yet.
      setAccount(mine.status === 204 ? null : mine.data);
    } catch (error) {
      setEnabled(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!riotId.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await linkRiotAccount({ riot_id: riotId.trim(), platform });
      setAccount(response.data);
      setRiotId('');
      setMessage({ severity: 'success', text: `Linked ${response.data.riot_id}.` });
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error, 'That account could not be linked.') });
    } finally { setBusy(false); }
  };

  const refresh = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await refreshRiotAccount();
      setAccount(response.data);
      setMessage({ severity: 'success', text: 'Profile refreshed.' });
    } catch (error) {
      // A 429 here is the cache cooldown, not a Riot rate limit.
      setMessage({ severity: 'info', text: getApiErrorMessage(error, 'Could not refresh right now.') });
    } finally { setBusy(false); }
  };

  const unlink = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await unlinkRiotAccount();
      setAccount(null);
      setMessage({ severity: 'success', text: 'Account unlinked.' });
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error, 'Could not unlink the account.') });
    } finally { setBusy(false); }
  };

  // Nothing to show while checking, or when the server has no Riot key.
  if (enabled === null || enabled === false) return null;

  return (
    <Card sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
        <SportsEsportsRounded sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>League of Legends</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Link your Riot ID to show your rank on team rosters. Only you can link your own account,
        and you can unlink it at any time.
      </Typography>

      {!isAuthenticated ? (
        <Alert severity="info" action={<Button color="inherit" size="small" onClick={signIn}>Sign in</Button>}>
          Sign in with Discord to link your Riot account.
        </Alert>
      ) : account ? (
        <>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar src={account.profile_icon_url || undefined} alt="" sx={{ width: 56, height: 56 }} />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 750 }} noWrap>{account.riot_id}</Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <RankChip riot={account} />
                {account.summoner_level != null && (
                  <Typography variant="caption" color="text.secondary">Level {account.summoner_level}</Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {account.platform?.toUpperCase()}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<AutorenewRounded />} onClick={refresh} disabled={busy}>
              Refresh
            </Button>
            <Button size="small" color="error" startIcon={<LinkOffRounded />} onClick={unlink} disabled={busy}>
              Unlink
            </Button>
          </Stack>
        </>
      ) : (
        <Box component="form" onSubmit={submit}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
            <TextField
              label="Riot ID"
              placeholder="GameName#TAG"
              value={riotId}
              onChange={(event) => setRiotId(event.target.value)}
              size="small"
              fullWidth
              helperText="Find it on your Riot account page"
            />
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel>Region</InputLabel>
              <Select label="Region" value={platform} onChange={(event) => setPlatform(event.target.value)}>
                {PLATFORMS.map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              type="submit"
              variant="contained"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <LinkRounded />}
              disabled={busy || !riotId.trim()}
              sx={{ mt: { sm: 0.25 } }}
            >
              Link
            </Button>
          </Stack>
        </Box>
      )}

      {message && <Alert severity={message.severity} sx={{ mt: 2 }}>{message.text}</Alert>}
    </Card>
  );
};

export default RiotAccountCard;
