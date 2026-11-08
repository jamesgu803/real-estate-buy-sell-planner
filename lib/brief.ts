import { z } from "zod";

export const Brief = z.object({
  headline: z.string().describe("One sentence the advisor could open the meeting with"),
  talkingPoints: z.array(z.object({ title: z.string(), body: z.string() })).describe("Three to four points"),
  questions: z.array(z.string()).describe("Questions to ask the client that would change the recommendation"),
  caveats: z.array(z.string()).describe("Assumptions in the model the advisor should confirm"),
});

export type Brief = z.infer<typeof Brief>;
