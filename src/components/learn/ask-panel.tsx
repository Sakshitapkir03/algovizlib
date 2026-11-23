"use client";

import { MessageCircleQuestion, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { InlineText } from "@/components/catalog/rich-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePlayerStore } from "@/store/player-store";

/** Matches the server's limit (`MAX_QUESTION_LENGTH` in lib/tutor/config.ts). */
const MAX_LENGTH = 300;
/** Earlier exchanges on this step that go back with a question (the server keeps 3). */
const MAX_HISTORY = 3;

type Exchange = { question: string; answer: string; failed?: boolean };
type Info = { label: string; suggestions: string[]; remaining: number; resetsAt: number };

/**
 * "Ask about this step": a button under the player that pauses the video and opens a panel tied to the scene on
 * screen: its label ("Step 4 of 9: 3 needs a 6"), two or three suggested questions, and a box for your own (at most
 * 300 characters). Answers stream in. The conversation belongs to that scene: moving to another one starts fresh.
 * Signed-out learners see "Sign in to ask". Esc closes the panel and returns focus to the button.
 */
export function AskAboutStep({ problemKey, sceneId }: { problemKey: string; sceneId: string }) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  // Once opened, the conversation stays mounted (hidden while closed), so reopening on the same scene keeps it.
  const [started, setStarted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Closing returns focus to the button, once it's back on the page.
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  const close = useCallback(() => {
    returnFocus.current = true;
    setOpen(false);
  }, []);

  const openPanel = () => {
    const { isPlaying, toggle } = usePlayerStore.getState();
    if (isPlaying) toggle();
    setStarted(true);
    setOpen(true);
  };

  if (status === "loading") return null;
  if (status !== "authenticated")
    return (
      <div className="flex items-center gap-2 border-t px-3 py-2 text-sm">
        <MessageCircleQuestion aria-hidden className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Ask about this step:</span>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`${typeof window === "undefined" ? "" : window.location.pathname}#resume`)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in to ask
        </Link>
      </div>
    );

  return (
    <div className="border-t">
      {!open && (
        <div className="px-3 py-2">
          <Button
            ref={buttonRef}
            size="sm"
            variant="outline"
            onClick={openPanel}
            aria-expanded={false}
            aria-controls={panelId}
          >
            <MessageCircleQuestion aria-hidden /> Ask about this step
          </Button>
        </div>
      )}
      {started && (
        // Keyed by scene: another scene is a new conversation, with fresh suggestions.
        <StepConversation
          key={sceneId}
          id={panelId}
          open={open}
          problemKey={problemKey}
          sceneId={sceneId}
          onClose={close}
        />
      )}
    </div>
  );
}

/** The open panel for one scene: its label, suggestions, the exchanges so far, and the question box. */
function StepConversation({
  id: panelId,
  open,
  problemKey,
  sceneId,
  onClose,
}: {
  id: string;
  open: boolean;
  problemKey: string;
  sceneId: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputId = useId();

  useEffect(() => {
    let live = true;
    void fetch(`/api/ask?problem=${encodeURIComponent(problemKey)}&scene=${encodeURIComponent(sceneId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!live) return;
        if (res.ok) setInfo(body as Info);
        else setNotice((body as { message?: string }).message ?? "The tutor isn't available right now.");
      })
      .catch(() => live && setNotice("The tutor isn't available right now."));
    return () => {
      live = false;
    };
  }, [problemKey, sceneId]);

  // Focus moves into the panel each time it opens; a new scene (unmounting this one) stops an answer still streaming.
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setNotice(null);
    setQuestion("");
    const history = exchanges.filter((e) => !e.failed).slice(-MAX_HISTORY);
    setExchanges((list) => [...list, { question: q, answer: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    const update = (answer: string, failed = false) =>
      setExchanges((list) => list.map((e, k) => (k === list.length - 1 ? { ...e, answer, failed } : e)));
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemKey,
          sceneId,
          question: q,
          history: history.map(({ question, answer }) => ({ question, answer })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        update(body.message ?? "The tutor couldn't answer that right now.", true);
        return;
      }
      const remaining = Number(res.headers.get("X-Tutor-Remaining"));
      if (Number.isFinite(remaining)) setInfo((i) => (i ? { ...i, remaining } : i));
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        update(answer);
      }
    } catch {
      if (!controller.signal.aborted)
        update("The tutor couldn't answer that right now. Try again in a moment.", true);
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  };

  const close = onClose;

  return (
    <section
      id={panelId}
      hidden={!open}
      aria-labelledby={`${panelId}-title`}
      className="space-y-3 p-3 sm:p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={`${panelId}-title`}
            ref={headingRef}
            tabIndex={-1}
            className="text-sm font-semibold outline-none"
          >
            Ask about this step
          </h3>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {info?.label ?? "Loading the step…"}
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={close} aria-label="Close the tutor">
          <X aria-hidden />
        </Button>
      </div>

      {exchanges.length > 0 && (
        <ol className="space-y-3" aria-live="polite" aria-busy={busy}>
          {exchanges.map((e, k) => (
            <li key={k} className="space-y-1.5 text-sm">
              <p className="font-medium">
                <InlineText text={e.question} />
              </p>
              <p
                className={
                  e.failed
                    ? "rounded-md border border-dashed px-3 py-2 text-muted-foreground"
                    : "rounded-md bg-muted px-3 py-2 leading-relaxed"
                }
              >
                {e.answer ? (
                  <InlineText text={e.answer} />
                ) : (
                  <span className="text-muted-foreground">Thinking…</span>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}

      {notice && (
        <p role="alert" className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {info && exchanges.length === 0 && info.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {info.suggestions.map((s) => (
            <Button key={s} size="sm" variant="secondary" disabled={busy} onClick={() => void send(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(question);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Your question about this step
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id={inputId}
            value={question}
            maxLength={MAX_LENGTH}
            rows={2}
            placeholder="Ask about what's happening here…"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(question);
              }
            }}
            className="min-h-0 resize-none text-sm"
          />
          <Button type="submit" size="icon" disabled={busy || !question.trim()} aria-label="Ask">
            <SendHorizontal aria-hidden />
          </Button>
        </div>
        <p className="flex justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span>
            {info ? `${info.remaining} question${info.remaining === 1 ? "" : "s"} left today` : " "}
          </span>
          <span aria-hidden>
            {question.length}/{MAX_LENGTH}
          </span>
        </p>
      </form>
    </section>
  );
}
