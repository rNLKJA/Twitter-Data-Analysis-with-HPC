/**
 * Port of `utils.split_file_into_chunks`:
 *
 * ```python
 * chunk_size = math.ceil(file_size / size)
 * chunk_start = [s for s in range(0, file_size, chunk_size)]
 * chunk_end = chunk_start[1:] + [file_size]
 * ```
 *
 * For tiny files this can return fewer than `size` chunks (the original would
 * then fail with an IndexError on the extra ranks); callers should check.
 */
export function splitFileIntoChunks(
  fileSize: number,
  size: number,
): { start: number[]; end: number[] } {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  const chunkSize = Math.ceil(fileSize / size);
  const start: number[] = [];
  if (chunkSize > 0) for (let s = 0; s < fileSize; s += chunkSize) start.push(s);
  const end = start.slice(1);
  end.push(fileSize);
  return { start, end };
}

/**
 * Port of `mpi.get_task_ranks`: one rank does everything, otherwise ranks
 * 0, 1, 2 host Task 1, Task 2 and Task 3 respectively.
 */
export function getTaskRanks(size: number): readonly [number, number, number] {
  return size === 1 ? [0, 0, 0] : [0, 1, 2];
}

/**
 * The original only runs with 1 rank or with 3+ ranks: with 2 ranks
 * `get_task_ranks` still names rank 2 as the Task 3 host, which does not exist.
 */
export function isSupportedRankCount(size: number): boolean {
  return size === 1 || size >= 3;
}

/**
 * Order in which `mpi.gather_task_tdf` assembles a task's frames on the task
 * rank: its own frame first, then `comm.recv` from every other rank in order.
 */
export function gatherOrder(taskRank: number, size: number): number[] {
  return [taskRank, ...Array.from({ length: size }, (_, r) => r).filter((r) => r !== taskRank)];
}
