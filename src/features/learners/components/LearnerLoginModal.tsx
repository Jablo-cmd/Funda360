import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerLoginModalProps {
  learnerId: string;
  learnerFirstName: string;
  onClose: () => void;
  onProvisioned: () => void;
}

export function LearnerLoginModal({ learnerId, learnerFirstName, onClose, onProvisioned }: LearnerLoginModalProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address for the learner.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('provision_learner_login', {
        p_learner_id: learnerId,
        p_email: email.trim(),
        p_phone: phone.trim() || null,
      });
      if (rpcError) throw rpcError;
      const row = (data as { user_id: string; temporary_password: string }[])[0];
      setTempPassword(row?.temporary_password ?? null);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to provision the login.'));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    const done = tempPassword !== null;
    onClose();
    if (done) onProvisioned();
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title={tempPassword ? 'Login provisioned' : 'Provision learner login'}
      footer={
        tempPassword ? (
          <Button type="button" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} isLoading={busy}>
              Provision login
            </Button>
          </div>
        )
      }
    >
      {tempPassword ? (
        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 font-medium text-success-500">
            The learner login was created.
          </div>
          <div className="rounded-lg border border-border bg-surface-sunken px-3.5 py-3">
            <p className="text-content-secondary">
              Temporary password — share this with {learnerFirstName}, it won&rsquo;t be shown again:
            </p>
            <p className="mt-1.5 select-all break-all font-mono text-content-primary">{tempPassword}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ErrorAlert message={error} />
          <p className="text-sm text-content-secondary">
            Creates a learner-role login linked to this record. A one-time temporary password is shown once, here.
          </p>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
