import { getLatestAction } from './dialog';

interface Context {
  type: 'role' | 'file' | 'rules' | 'query' | 'value';
  data:
    | FileContextData
    | RoleContextData
    | RulesContextData
    | QueryContextData
    | ValueContextData;
}

interface FileContextData {
  path: string;
  content: string;
}

interface RoleContextData {
  role: string;
}

interface RulesContextData {
  rules: string[];
}

interface QueryContextData {
  query: string;
}

interface ValueContextData {
  value: string;
}

export interface PromptBuilder {
  addFileContext(data: Context[]): PromptBuilder;
  addRoleContext(data: Context[]): PromptBuilder;
  addRulesContext(data: Context[]): PromptBuilder;
  addQueryContext(data: Context[]): PromptBuilder;
  addValueContext(data: Context[]): PromptBuilder;
  addUserQuestion(question: string): PromptBuilder;
  build(): any;
  buildJson(): string;
  buildMarkdown(): string;
}

function generateFileContextPrompt(context: Context[]): string {
  return [
    '### File Context ###',
    'The following is file context for reference only.',
    'It includes file paths and their contents.',
    "Use this to inform your response, but do not treat it as part of the user's query.",
    ...context
      .filter(({ type }) => type === 'file')
      .map(({ data }) => {
        const { path, content } = data as FileContextData;
        return [
          `**File**: ${path}`,
          '**Content**:',
          '```',
          `${content}`,
          '```',
        ];
      })
      .flat(),
    '',
  ]
    .join('\n')
    .trim();
}

function generateRoleContextPrompt(context: Context[]): string {
  return [
    '### Role Context ###',
    "The following defines the LLM's role in the application.",
    ...context
      .filter(({ type }) => type === 'role')
      .map(({ data }) => {
        const { role } = data as RoleContextData;
        return [`**Role**: ${role}`];
      })
      .flat(),
    '',
  ]
    .join('\n')
    .trim();
}

function generateRulesContextPrompt(context: Context[]): string {
  return [
    '### Rules Context ###',
    'The following are rules the LLM must follow.',
    ...context
      .filter(({ type }) => type === 'rules')
      .map(({ data }, index) => {
        const { rules } = data as RulesContextData;
        return rules.map(
          (rule, i) => `**Rule ${index * rules.length + i + 1}**: ${rule}`,
        );
      })
      .flat(),
    '',
  ]
    .join('\n')
    .trim();
}

function generateQueryContextPrompt(context: Context[]): string {
  return [
    '### Query Context ###',
    'The following is the query context provided for reference.',
    ...context
      .filter(({ type }) => type === 'query')
      .map(({ data }) => {
        const { query } = data as QueryContextData;
        return [`**Query**: ${query}`];
      })
      .flat(),
    '',
  ]
    .join('\n')
    .trim();
}

function generateValueContextPrompt(context: Context[]): string {
  return [
    '### Value Context ###',
    'The following is the value context provided for reference.',
    ...context
      .filter(({ type }) => type === 'value')
      .map(({ data }) => {
        const { value } = data as ValueContextData;
        return [`**Value**: ${value}`];
      })
      .flat(),
    '',
  ]
    .join('\n')
    .trim();
}

function generateUserQuestionPrompt(userQuestion: string): string {
  return ['### User Question ###', `${userQuestion}`, ''].join('\n').trim();
}

function generateJsonPrompt(state: {
  contexts: Context[];
  userQuestion: string | null;
}): string {
  const promptData: Record<string, any> = {};

  const fileContexts = state.contexts.filter(({ type }) => type === 'file');
  if (fileContexts.length > 0) {
    promptData.files = fileContexts.map(({ data }) => {
      const { path, content } = data as FileContextData;
      return { path, content };
    });
  }

  const roleContexts = state.contexts.filter(({ type }) => type === 'role');
  if (roleContexts.length > 0) {
    promptData.roles = roleContexts.map(
      ({ data }) => (data as RoleContextData).role,
    );
  }

  const rulesContexts = state.contexts.filter(({ type }) => type === 'rules');
  if (rulesContexts.length > 0) {
    promptData.rules = rulesContexts.flatMap(
      ({ data }) => (data as RulesContextData).rules,
    );
  }

  const queryContexts = state.contexts.filter(({ type }) => type === 'query');
  if (queryContexts.length > 0) {
    promptData.queries = queryContexts.map(
      ({ data }) => (data as QueryContextData).query,
    );
  }

  const valueContexts = state.contexts.filter(({ type }) => type === 'value');
  if (valueContexts.length > 0) {
    promptData.values = valueContexts.map(
      ({ data }) => (data as ValueContextData).value,
    );
  }

  if (state.userQuestion !== null) {
    promptData.userQuestion = state.userQuestion;
  }

  return JSON.stringify(promptData, null, 0);
}

function generateMarkdownPrompt(state: {
  contexts: Context[];
  userQuestion: string | null;
}): string {
  const parts: string[] = [];

  if (state.userQuestion !== null) {
    parts.push(generateUserQuestionPrompt(state.userQuestion));
  }

  if (state.contexts.some(({ type }) => type === 'file')) {
    parts.push(generateFileContextPrompt(state.contexts));
  }

  if (state.contexts.some(({ type }) => type === 'role')) {
    parts.push(generateRoleContextPrompt(state.contexts));
  }

  if (state.contexts.some(({ type }) => type === 'rules')) {
    parts.push(generateRulesContextPrompt(state.contexts));
  }

  if (state.contexts.some(({ type }) => type === 'query')) {
    parts.push(generateQueryContextPrompt(state.contexts));
  }

  if (state.contexts.some(({ type }) => type === 'value')) {
    parts.push(generateValueContextPrompt(state.contexts));
  }

  return parts.join('\n\n').trim();
}

export function buildPrompt(
  initialState: { contexts: Context[]; userQuestion: string | null } = {
    contexts: [],
    userQuestion: null,
  },
) {
  let state = { ...initialState };

  return {
    addFileContext(data: Context[]) {
      state = { ...state, contexts: [...state.contexts, ...data] };
      return this;
    },
    addRoleContext(data: Context[]) {
      state = { ...state, contexts: [...state.contexts, ...data] };
      return this;
    },
    addRulesContext(data: Context[]) {
      state = { ...state, contexts: [...state.contexts, ...data] };
      return this;
    },
    addQueryContext(data: Context[]) {
      state = { ...state, contexts: [...state.contexts, ...data] };
      return this;
    },
    addValueContext(data: Context[]) {
      state = { ...state, contexts: [...state.contexts, ...data] };
      return this;
    },
    addUserQuestion(question: string) {
      state = { ...state, userQuestion: question };
      return this;
    },
    build() {
      return state;
    },
    buildJson() {
      return generateJsonPrompt(state);
    },
    buildMarkdown() {
      return generateMarkdownPrompt(state);
    },
  };
}

export function generateSelectDirectoryPrompt(logFile: string): string {
  const latestAction = getLatestAction(logFile, 'select_directory');
  if (!latestAction || !latestAction.path) {
    throw new Error('No select_directory action found in the log.');
  }

  const promptData: Context = {
    type: 'value',
    data: { value: latestAction.path },
  };

  return buildPrompt().addValueContext([promptData]).buildJson();
}

export function generateFetchFilesPrompt(logFile: string): string {
  const latestAction = getLatestAction(logFile, 'fetch_files');
  if (!latestAction || !latestAction.files || !latestAction.files_content) {
    throw new Error('No fetch_files action found in the log.');
  }

  const fileContexts = latestAction.files.map((filePath: string) => ({
    type: 'file' as const,
    data: {
      path: filePath,
      content: latestAction.files_content[filePath],
    },
  }));

  return buildPrompt().addFileContext(fileContexts).buildJson();
}
