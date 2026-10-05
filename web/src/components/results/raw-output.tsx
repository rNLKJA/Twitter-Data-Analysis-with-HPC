import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK1, TASK1_ID_NOTE, TASK2, TASK3 } from "@/lib/data/original";

function csvLine(cells: readonly (string | number)[]) {
  return cells
    .map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)))
    .join(",");
}

interface ResultFile {
  id: string;
  file: string;
  /** Caveat shown above the file. */
  note?: string;
  lines: string[];
}

const FILES: ResultFile[] = [
  {
    id: "task1",
    file: "data/result/task1.csv",
    note: `Reconstructed from the report. ${TASK1_ID_NOTE}`,
    lines: [
      csvLine(["Rank", "Author Id", "Number of Tweets Made"]),
      ...TASK1.map((r) => csvLine([`#${r.rank}`, r.authorId, r.tweets])),
    ],
  },
  {
    id: "task2",
    file: "data/result/task2.csv",
    lines: [
      csvLine(["Greater Captical City", "Number of Tweets Made"]),
      ...TASK2.map((r) => csvLine([r.gcc, r.tweets])),
    ],
  },
  {
    id: "task3",
    file: "data/result/task3.csv",
    lines: [
      csvLine(["Rank", "Author Id", "Number of Unique City Locations and #Tweets"]),
      ...TASK3.map((r) => csvLine([r.rank, r.authorId, r.text])),
    ],
  },
];

/**
 * The three result files in the shape main.py writes them (header typo
 * included). Task 1's author IDs are the report's rounded ones, and say so.
 */
export function RawOutput() {
  return (
    <Tabs defaultValue="task1" className="w-full">
      <TabsList aria-label="Result files">
        {FILES.map((f) => (
          <TabsTrigger key={f.id} value={f.id} className="font-mono text-xs">
            {f.id}.csv
          </TabsTrigger>
        ))}
      </TabsList>
      {FILES.map((f) => (
        <TabsContent key={f.id} value={f.id}>
          {f.note && <p className="mt-2 text-xs text-muted-foreground">{f.note}</p>}
          <div className="mt-2 overflow-hidden rounded-lg border bg-muted/40">
            <div className="flex items-center justify-between border-b px-3 py-1.5 font-mono text-[0.7rem] text-muted-foreground">
              <span>{f.file}</span>
              <span>{f.lines.length - 1} rows</span>
            </div>
            <pre
              className="max-h-80 overflow-auto p-3 font-mono text-[0.75rem] leading-relaxed"
              tabIndex={0}
            >
              <code>{f.lines.join("\n")}</code>
            </pre>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
