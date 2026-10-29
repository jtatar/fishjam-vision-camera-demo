type CommandQueueOptions = {
  apply: (value: number) => Promise<void>;
  onApplied?: (value: number, requestId?: number) => void;
  onError: (error: unknown, requestId?: number) => void;
  /** A previous session's cleanup must finish before this queue touches its camera. */
  after?: Promise<void>;
};

type Command = {
  value: number;
  requestId?: number;
};

// Run one native command at a time and replace pending commands with the newest.
// Closing drops pending requests, applies optional cleanup, and waits for it.
export function createCameraCommandQueue({
  apply,
  onApplied,
  onError,
  after,
}: CommandQueueOptions) {
  let pendingCommand: Command | undefined;
  let lastAppliedValue: number | undefined;
  let isClosed = false;
  let isDraining = false;
  let resolveClosed!: () => void;
  const closedPromise = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  async function drain() {
    if (isDraining) return;
    isDraining = true;

    try {
      if (after) {
        await after;
        after = undefined;
      }

      while (pendingCommand !== undefined) {
        const { value, requestId } = pendingCommand;
        pendingCommand = undefined;

        try {
          if (isClosed || value !== lastAppliedValue) {
            await apply(value);
            lastAppliedValue = value;
          }

          if (!isClosed) onApplied?.(value, requestId);
        } catch (error) {
          if (!isClosed) onError(error, requestId);
        }
      }
    } finally {
      isDraining = false;
      if (isClosed) resolveClosed();
    }
  }

  return {
    submit(value: number, requestId?: number) {
      if (isClosed) return;
      pendingCommand = { value, requestId };
      void drain();
    },

    close(finalCommand?: { value: number }) {
      if (!isClosed) {
        isClosed = true;
        pendingCommand = finalCommand;
        void drain();
      }

      return closedPromise;
    },
  };
}

export type CameraCommandQueue = ReturnType<typeof createCameraCommandQueue>;
