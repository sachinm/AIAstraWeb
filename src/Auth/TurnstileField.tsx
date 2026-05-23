import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    onRegisterReset?.(() => {
      ref.current?.reset();
    });
  }, [onRegisterReset]);

  return (
    <div className={className} data-test-id="turnstile-field">
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onSuccess}
        onExpire={onExpire}
        onError={onError}
        options={{
          theme: 'dark',
          size: 'normal',
          ...(action ? { action } : {}),
        }}
      />
    </div>
  );
};

export default TurnstileField;
