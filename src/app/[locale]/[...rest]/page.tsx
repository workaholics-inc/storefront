import { notFound } from "next/navigation";

// A segment's not-found.tsx only catches explicit notFound() calls, so an
// unmatched address goes through here to show it inside the layout.
export default function CatchAll() {
  notFound();
}
