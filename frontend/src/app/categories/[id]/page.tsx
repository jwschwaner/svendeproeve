'use client';

import { use, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
} from '@mui/material';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useCategories } from '@/hooks/useCategories';
import { organizationApi, categoryApi, Member, Email } from '@/lib/api';
import useSWR from 'swr';

function formatDate(raw: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCaseStatus(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (s === 'open') return 'Open';
  if (s === 'closed') return 'Closed';
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * One row per thread: latest message drives From / last activity / status;
 * subject is always taken from the first email in the thread (earliest created_at).
 */
function oneRowPerThread(emails: Email[]): Email[] {
  const groups = new Map<string, Email[]>();
  for (const e of emails) {
    const threadKey = (e.thread_id || '').trim() || e.id;
    const list = groups.get(threadKey) || [];
    list.push(e);
    groups.set(threadKey, list);
  }

  const rows: Email[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    rows.push({
      ...latest,
      subject: first.subject ?? '',
    });
  }
  return rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, token } = useAuth();
  const { currentOrg } = useOrganizations();

  const { data: members, isLoading: isLoadingMembers } = useSWR<Member[]>(
    currentOrg && token ? ['members', currentOrg.id, token] : null,
    ([_, orgId, token]) => organizationApi.listMembers(orgId, token),
    { revalidateOnFocus: false }
  );

  const currentUserRole = members?.find(m => m.user_id === user?.id)?.role;

  const { categories, isLoading: isLoadingCategories } = useCategories({ userId: user?.id, userRole: currentUserRole });
  const category = categories.find(c => c.id === id);

  const { data: emails, isLoading: isLoadingEmails } = useSWR<Email[]>(
    currentOrg && token && category ? ['emails', currentOrg.id, id, token] : null,
    ([_, orgId, categoryId, tok]) => categoryApi.listEmails(orgId, categoryId, tok),
    { revalidateOnFocus: false }
  );

  const threadRows = useMemo(() => (emails?.length ? oneRowPerThread(emails) : []), [emails]);

  if (isLoadingMembers || isLoadingCategories) {
    return (
      <DashboardLayout userName={user?.full_name} userRole={currentUserRole}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  if (!category) {
    return (
      <DashboardLayout userName={user?.full_name} userRole={currentUserRole}>
        <Typography variant="h5" sx={{ color: 'text.secondary' }}>
          You do not have access to this category.
        </Typography>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userName={user?.full_name} userRole={currentUserRole}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        {category.color && (
          <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: category.color, flexShrink: 0 }} />
        )}
        <Typography variant="h4" sx={{ color: 'white' }}>
          {category.name}
        </Typography>
      </Box>

      {isLoadingEmails ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Subject</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>From</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Last activity</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {threadRows.length > 0 ? threadRows.map(email => (
                <TableRow
                  key={(email.thread_id || '').trim() || email.id}
                  sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                >
                  <TableCell sx={{ color: 'white' }}>{email.subject || '(no subject)'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{email.sender}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{formatDate(email.date || email.created_at)}</TableCell>
                  <TableCell>
                    <Chip
                      label={formatCaseStatus(email.case_status)}
                      size="small"
                      sx={{
                        bgcolor: email.case_status?.toLowerCase() === 'open' ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.08)',
                        color: email.case_status?.toLowerCase() === 'open' ? '#4caf50' : 'text.secondary',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                    No threads in this category yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DashboardLayout>
  );
}
