import { COUNTRIES } from '@kushlov/utils';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function CountrySelect({
  id,
  value,
  onChange,
  className,
  placeholder = 'Select your country',
  required,
  disabled,
}: Props) {
  return (
    <select
      id={id}
      value={value}
      required={required}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <option value="" disabled className="bg-zinc-900">
        {placeholder}
      </option>
      {COUNTRIES.map((c) => (
        <option key={c} value={c} className="bg-zinc-900">
          {c}
        </option>
      ))}
    </select>
  );
}
