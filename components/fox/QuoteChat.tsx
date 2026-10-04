'use client';

/** Vulpi's short conversational quote request: name -> phone -> email -> address -> optional photos -> review -> send. */
import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { cn } from '@/lib/utils';
import { SMS_CONSENT_TEXT } from '@/lib/sms-consent';
import { LINES, fill, type FoxLine } from './script';
import s from './FoxGuide.module.css';

export interface ChatMsg {
  from: 'fox' | 'me';
  text: string;
  id?: string;
}

type Step = 'name' | 'phone' | 'email' | 'address' | 'photos' | 'review' | 'sending' | 'done' | 'error';

const MAX_PHOTOS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  log: ChatMsg[];
  setLog: Dispatch<SetStateAction<ChatMsg[]>>;
  foxSays: (line: FoxLine) => void;
  onCelebrate: () => void;
  onClose: () => void;
  quoteMessage: string;
  designRef: string;
  designLabel: string;
  summaryHref: string;
  fullFormHref: string;
}

/** Downscale to <=1600px JPEG so uploads stay small; falls back to the original file. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function QuoteChat(p: Props) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [hint, setHint] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = name.trim().split(/\s+/)[0] || '';

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [p.log, step]);
  useEffect(() => {
    setHint('');
    const t = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(t);
  }, [step]);
  useEffect(() => () => photos.forEach((ph) => URL.revokeObjectURL(ph.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const me = (text: string) => p.setLog((l) => [...l, { from: 'me', text }]);
  const go = (next: Step, line?: FoxLine) => {
    if (line) window.setTimeout(() => p.foxSays(line), 350);
    setStep(next);
  };
  const warn = (line: FoxLine) => {
    setHint(line.text);
    p.foxSays(line);
  };

  const submitStep = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'name') {
      if (name.trim().length < 2) return setHint('Just a first name is fine.');
      me(name.trim());
      go('phone', fill(LINES.qPhone, { name: first }));
    } else if (step === 'phone') {
      const digits = phone.replace(/\D/g, '');
      if (phone.trim() && digits.length < 10) return setHint('That number looks short. Include the area code.');
      me(phone.trim() || 'Skip');
      go('email', LINES.qEmail);
    } else if (step === 'email') {
      if (email.trim() && !EMAIL_RE.test(email.trim())) return warn(LINES.qBadEmail);
      if (!email.trim() && !phone.trim()) return warn(LINES.qNeedContact);
      me(email.trim() || 'Skip');
      go('address', LINES.qAddress);
    } else if (step === 'address') {
      if (address.trim().length < 4) return setHint('A street address, or at least city and ZIP, please.');
      me(address.trim());
      go('photos', LINES.qPhotos);
    } else if (step === 'photos') {
      me(photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} attached` : 'No photos');
      go('review', LINES.qReview);
    }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) break;
      if (!f.type.startsWith('image/')) continue;
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPhotos(next);
    if (files.length + photos.length > MAX_PHOTOS) setHint(`Up to ${MAX_PHOTOS} photos.`);
  };

  const send = async () => {
    setStep('sending');
    p.foxSays(LINES.qSending);
    const q = new URLSearchParams(window.location.search);
    const message = [
      p.quoteMessage,
      `Design ref: ${p.designRef}`,
      `Property address: ${address.trim()}`,
      photos.length ? `Photos attached: ${photos.length}` : '',
      'Sent through Vulpi, the configurator guide.',
    ]
      .filter(Boolean)
      .join('\n');
    const fields: Record<string, string> = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      projectLocation: address.trim(),
      projectType: 'Cabinet configurator',
      projectDetails: message,
      source: '/configurator (Vulpi)',
      // canonical design query (style=...&color=...) for the server-side summary PDF / GoHighLevel
      config: p.summaryHref.split('?')[1] || '',
      pageUrl: window.location.href,
      utm_source: q.get('utm_source') || '',
      utm_medium: q.get('utm_medium') || '',
      utm_campaign: q.get('utm_campaign') || '',
      utm_content: q.get('utm_content') || '',
      utm_term: q.get('utm_term') || '',
      smsConsent: sms && phone.trim() ? 'true' : 'false',
    };
    try {
      let res: Response;
      if (photos.length) {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        const blobs = await Promise.all(photos.map((ph) => compress(ph.file)));
        blobs.forEach((b, i) => fd.append('photos', b, `photo-${i + 1}.jpg`));
        res = await fetch('/api/request-bid', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/request-bid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, smsConsent: fields.smsConsent === 'true' }),
        });
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Request failed');
      setStep('done');
      p.foxSays(fill(LINES.qDone, { name: first }));
      p.onCelebrate();
    } catch (err) {
      console.warn('[fox] quote request failed', err);
      setStep('error');
      p.foxSays(LINES.qError);
    }
  };

  const restart = () => {
    me('Edit my details');
    setStep('name');
  };

  const input = (props: { type: string; value: string; set: (v: string) => void; label: string; placeholder: string; autoComplete: string; inputMode?: 'tel' | 'email' | 'text' }) => (
    <label className={s.chatField}>
      <span className={s.srOnly}>{props.label}</span>
      <input
        ref={inputRef}
        className={s.chatInput}
        type={props.type}
        value={props.value}
        onChange={(e) => props.set(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        aria-invalid={Boolean(hint) || undefined}
        aria-describedby={hint ? 'fox-chat-hint' : undefined}
      />
    </label>
  );

  return (
    <div className={s.chat} role="dialog" aria-label="Request a custom quote with Vulpi">
      <div className={s.chatHead}>
        <div>
          <p className={s.chatTitle}>Custom quote</p>
          <p className={s.chatSub}>{p.designLabel}</p>
        </div>
        <button type="button" className={s.chatClose} aria-label="Close quote chat" onClick={p.onClose}>
          ×
        </button>
      </div>

      <div ref={logRef} className={s.chatLog} aria-live="polite">
        {p.log.map((m, i) => (
          <p key={i} className={cn(s.msg, m.from === 'me' ? s.msgMe : s.msgFox)}>
            {m.text}
          </p>
        ))}
        {(step === 'review' || step === 'sending') && (
          <dl className={s.review}>
            <dt>Name</dt>
            <dd>{name}</dd>
            {phone && (
              <>
                <dt>Phone</dt>
                <dd>{phone}</dd>
              </>
            )}
            {email && (
              <>
                <dt>Email</dt>
                <dd>{email}</dd>
              </>
            )}
            <dt>Property</dt>
            <dd>{address}</dd>
            <dt>Design</dt>
            <dd>
              {p.designLabel} <span className={s.ref}>({p.designRef})</span>
            </dd>
            {photos.length > 0 && (
              <>
                <dt>Photos</dt>
                <dd>{photos.length}</dd>
              </>
            )}
          </dl>
        )}
      </div>

      <form className={s.chatForm} onSubmit={submitStep} noValidate>
        {step === 'name' && input({ type: 'text', value: name, set: setName, label: 'Your name', placeholder: 'Your name', autoComplete: 'name' })}
        {step === 'phone' && (
          <>
            {input({ type: 'tel', value: phone, set: setPhone, label: 'Phone number', placeholder: '(555) 555-5555', autoComplete: 'tel', inputMode: 'tel' })}
            {phone.trim() && (
              <label className={s.consent}>
                <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} />
                <span>{SMS_CONSENT_TEXT}</span>
              </label>
            )}
          </>
        )}
        {step === 'email' && input({ type: 'email', value: email, set: setEmail, label: 'Email', placeholder: 'you@example.com', autoComplete: 'email', inputMode: 'email' })}
        {step === 'address' && input({ type: 'text', value: address, set: setAddress, label: 'Property address', placeholder: 'Street, city, ZIP', autoComplete: 'street-address' })}
        {step === 'photos' && (
          <div className={s.photos}>
            {photos.map((ph, i) => (
              <span key={ph.url} className={s.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={`Photo ${i + 1}`} />
                <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((list) => list.filter((x) => x !== ph))}>
                  ×
                </button>
              </span>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className={s.addPhoto}>
                <input ref={inputRef} type="file" accept="image/*" multiple className={s.srOnly} onChange={(e) => addPhotos(e.target.files)} />
                <span aria-hidden="true">+</span>
                <span className={s.srOnly}>Add photos of your kitchen</span>
              </label>
            )}
          </div>
        )}

        {hint && (
          <p id="fox-chat-hint" className={s.hint} role="alert">
            {hint}
          </p>
        )}

        <div className={s.chatActions}>
          {['name', 'phone', 'email', 'address'].includes(step) && (
            <>
              {(step === 'phone' || (step === 'email' && phone.trim())) && (
                <button
                  type="button"
                  className={s.bubbleBtn}
                  onClick={() => {
                    if (step === 'phone') setPhone('');
                    else setEmail('');
                    me('Skip');
                    if (step === 'phone') go('email', LINES.qEmail);
                    else go('address', LINES.qAddress);
                  }}
                >
                  Skip
                </button>
              )}
              <button type="submit" className={cn(s.bubbleBtn, s.bubbleBtnPrimary)}>
                Next
              </button>
            </>
          )}
          {step === 'photos' && (
            <button type="submit" className={cn(s.bubbleBtn, s.bubbleBtnPrimary)}>
              {photos.length ? 'Continue' : 'Skip photos'}
            </button>
          )}
          {step === 'review' && (
            <>
              <button type="button" className={s.bubbleBtn} onClick={restart}>
                Edit
              </button>
              <button type="button" className={cn(s.bubbleBtn, s.bubbleBtnPrimary)} onClick={send}>
                Send for my custom quote
              </button>
            </>
          )}
          {step === 'sending' && (
            <button type="button" className={cn(s.bubbleBtn, s.bubbleBtnPrimary)} disabled>
              Sending…
            </button>
          )}
          {step === 'error' && (
            <button type="button" className={cn(s.bubbleBtn, s.bubbleBtnPrimary)} onClick={send}>
              Try again
            </button>
          )}
          {step === 'done' && (
            <>
              <a className={s.bubbleBtn} href={p.summaryHref}>
                Design summary
              </a>
              <button type="button" className={cn(s.bubbleBtn, s.bubbleBtnPrimary)} onClick={p.onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </form>

      {step !== 'done' && (
        <p className={s.chatFoot}>
          Prefer the full form? <a href={p.fullFormHref}>Use the request form</a>
        </p>
      )}
    </div>
  );
}
