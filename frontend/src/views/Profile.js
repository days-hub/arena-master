import React from 'react';
import { Alert, Avatar, Box, Button, Card, Chip, Stack, Typography } from '@mui/material';
import { LoginRounded } from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import RiotAccountCard from '../components/RiotAccountCard';

const Profile = () => {
  const { user, isAuthenticated, signIn } = useAuth();

  return (
    <Box>
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="Your Arena Master identity and the game accounts connected to it."
      />

      {!isAuthenticated ? (
        <Alert
          severity="info"
          action={<Button color="inherit" size="small" startIcon={<LoginRounded />} onClick={signIn}>Sign in</Button>}
        >
          Sign in with Discord to see your profile.
        </Alert>
      ) : (
        <Stack spacing={2.5}>
          <Card sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar src={user.avatar_url || undefined} alt={user.username} sx={{ width: 64, height: 64 }}>
                {user.username?.slice(0, 1)?.toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>{user.username}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label="Discord" variant="outlined" />
                  {user.is_admin && <Chip size="small" color="primary" label="Administrator" />}
                </Stack>
              </Box>
            </Stack>
          </Card>

          <RiotAccountCard />
        </Stack>
      )}
    </Box>
  );
};

export default Profile;
