'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  category: z.enum(['general', 'account', 'billing', 'host', 'safety', 'technical', 'other']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});
type Form = z.infer<typeof schema>;

interface Inquiry {
  _id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  createdAt: string;
}

const categories = [
  { value: 'general', label: 'General inquiry' },
  { value: 'account', label: 'Account & profile' },
  { value: 'billing', label: 'Billing & payments' },
  { value: 'host', label: 'Host program' },
  { value: 'safety', label: 'Safety & reporting' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'other', label: 'Other' },
] as const;

export default function ContactPage() {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { category: 'general' } });

  const history = useQuery({
    queryKey: ['contact-inquiries'],
    queryFn: () => unwrap<{ items: Inquiry[] }>(api.get('/contact')),
  });

  const submit = useMutation({
    mutationFn: (data: Form) => api.post('/contact', data),
    onSuccess: () => {
      toast.success('Inquiry submitted! Our team will respond within 24–48 hours.');
      reset({ category: 'general', subject: '', message: '' });
      qc.invalidateQueries({ queryKey: ['contact-inquiries'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const statusVariant = (s: string) =>
    s === 'resolved' ? 'success' : s === 'in_progress' ? 'warning' : 'secondary';

  return (
    <div>
      <PageHeader
        title="Contact Us"
        subtitle="Have a question or need help? Send us a message and we'll get back to you."
      />

      <div className="mx-auto grid max-w-5xl gap-8 p-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-card/70 p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold">Submit an inquiry</h2>
                <p className="text-sm text-white/45">We typically respond within 24–48 hours.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit((v) => submit.mutate(v))} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  {...register('category')}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-pink/60"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value} className="bg-card">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="Brief summary of your inquiry" {...register('subject')} />
                {errors.subject && <p className="text-xs text-red-400">{errors.subject.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={6}
                  placeholder="Describe your question or issue in detail…"
                  {...register('message')}
                />
                {errors.message && <p className="text-xs text-red-400">{errors.message.message}</p>}
              </div>
              <Button type="submit" className="w-full" loading={submit.isPending}>
                <Send className="h-4 w-4" /> Send inquiry
              </Button>
            </form>
          </div>
        </div>

        {/* Sidebar + history */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-card/70 p-5 text-sm">
            <h3 className="font-semibold">Other ways to reach us</h3>
            <ul className="mt-4 space-y-3 text-white/55">
              <li>
                <span className="text-white/35">Email:</span> support@kushlov.app
              </li>
              <li>
                <span className="text-white/35">Phone:</span> +1 (800) 555-KUSH
              </li>
              <li>
                <span className="text-white/35">Hours:</span> Mon–Fri, 9am–6pm PST
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
              <Clock className="h-4 w-4" /> Your past inquiries
            </h3>
            {history.isLoading && <Skeleton className="h-24 rounded-xl" />}
            {!history.isLoading && history.data?.items.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/40">
                No inquiries yet. Submit your first message above.
              </p>
            )}
            <div className="space-y-2">
              {history.data?.items.map((inq) => (
                <div key={inq._id} className="rounded-xl border border-white/10 bg-card/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{inq.subject}</p>
                    <Badge variant={statusVariant(inq.status) as any} className="shrink-0 capitalize">
                      {inq.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-white/45">{inq.message}</p>
                  <p className="mt-2 text-[10px] text-white/30">{relativeTime(inq.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
