export const shuffle = (A: any[], seed: number) => {
  const result = [...A]

  let state = seed
  function random() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}
