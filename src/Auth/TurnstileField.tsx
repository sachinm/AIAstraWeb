import { useEffect, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

interface TurnstileFieldProps {
  siteKey: string;
  action?: string;
  className?: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  onRegisterReset?: (reset: () => void) => void;
}

const TurnstileField: React.FC<TurnstileFieldProps> = ({
  siteKey,
  action,
  className = 'flex justify-center',
  onSuccess,
  onExpire,
  onError,
  onRegisterReset,
}) => {
  const ref = useRef<TurnstileInstance>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onRegisterReset?.(() => {
      ref.current?.reset();
    });
  }, [onRegisterReset]);

  return (
    <div className={`${className} min-h-[65px] items-center relative`} data-test-id="turnstile-field">
      {!loaded && (
        <span className="text-xs text-gray-400 animate-pulse absolute">
          Loading security check…
        </span>
      )}
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onWidgetLoad={() => setLoaded(true)}
        onSuccess={(token) => {
          setLoaded(true);
          onSuccess(token);
        }}
        onExpire={onExpire}
        onError={() => {
          setLoaded(true);
          onError?.();
        }}
        options={{
          theme: 'dark',
          size: 'normal',
          appearance: 'always',
          ...(action ? { action } : {}),
        }}
      />
    </div>
  );
};

export default TurnstileField;
