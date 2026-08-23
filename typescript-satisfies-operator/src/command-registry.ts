// keyof typeof over a satisfies-checked object keeps the exact key union.
interface Command {
  description: string;
  handler: (args: string[]) => Promise<void>;
}

const commands = {
  build: {
    description: 'Build the project',
    handler: async (args) => {
      void args.length;
    },
  },
  deploy: {
    description: 'Deploy to production',
    handler: async (args) => {
      void args.length;
    },
  },
} satisfies Record<string, Command>;

export type CommandName = keyof typeof commands;

export function runCommand(name: CommandName): Promise<void> {
  return commands[name].handler([]);
}

export const known: CommandName = 'build';
