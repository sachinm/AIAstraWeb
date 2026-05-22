import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

export interface TurnstileFieldHandle {
  reset: () => void;
}

interface TurnstileFieldProps {
  siteKey: string;
  action?: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  onRegisterReset?: (reset: () => void) => void;
  className?: string;
}

const TurnstileField = forwardRef<TurnstileFieldHandle, TurnstileFieldProps>(
  function TurnstileField(
    { siteKey, action, onSuccess, onExpire, onError, onRegisterReset, className },
    ref
  ) {
    const turnstileRef = useRef<TurnstileInstance>(null);

    const reset = () => {
      turnstileRef.current?.reset();
    };

    useImperativeHandle(ref, () => ({ reset }), []);

    useEffect(() => {
      onRegisterReset?.(reset);
    }, [onRegisterReset]);

    if (!siteKey) return null;

    return (
      <div className={className ?? 'flex justify-center'}>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          options={{ action }}
          onSuccess={onSuccess}
          onExpire={() => {
            onExpire?.();
          }}
          onError={() => {
            onError?.();
          }}
        />
      </div>
    );
  }
);

export default TurnstileField;
