const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  java: ['.java'],
  go: ['.go'],
  rust: ['.rs'],
  javascript: ['.js', '.jsx', '.mjs']
}

export const getLanguageExtensions = (language: string) => LANGUAGE_EXTENSIONS[language] ?? []

export const getLanguage = (filepath: string) =>
  Object.keys(LANGUAGE_EXTENSIONS).find(language => LANGUAGE_EXTENSIONS[language].some(extension => filepath.endsWith(extension))) ?? 'unknown'
