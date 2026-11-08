import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import QuestionsPanel from "../components/evidenceboard/QuestionsPanel";
import EvidenceCard from "../components/evidenceboard/EvidenceCard";
import AddEvidenceModal from "../components/evidenceboard/AddEvidenceModal";
import { COLUMNS } from "../components/evidenceboard/Columns";
import LoadingScreen from "../components/shared/LoadingScreen";
import type { BoardResponse, Stance } from "../types";

// Research questions on top, then the evidence board: cards arranged under what they support, challenge, and more.
export default function EvidenceBoard() {
  // the board belongs to the collection in the URL: /Collection/:collectionId/board
  const { id: routeId } = useParams();
  const { collections, ready } = useCollections();
  const current = (collections ?? []).find((c) => c.id === routeId);
  const dialog = useDialog();
  const collectionId = current?.id;
  const canEdit = !!current && current.role !== "viewer";

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [error, setError] = useState("");
  const [questionFilter, setQuestionFilter] = useState(""); // "" = all evidence
  const [adding, setAdding] = useState<Stance | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Stance | null>(null);
  const latest = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    const id = collectionId;
    if (!id) return;
    try {
      const r = await api<BoardResponse>(`/board/${id}`);
      if (latest.current !== id) return; // the collection changed while this was loading
      setBoard(r);
      setError("");
    } catch (e) {
      if (latest.current === id) setError(e instanceof Error ? e.message : "Couldn't load the board");
    }
  }, [collectionId]);

  useEffect(() => {
    latest.current = collectionId;
    setBoard(null);
    setQuestionFilter("");
    void load();
  }, [collectionId, load]);

  async function moveCard(id: string, stance: Stance, beforeId: string | null) {
    if (id === beforeId) return;
    // show the card in its new column straight away; the reload below puts it in its exact place
    setBoard((b) => b && { ...b, links: b.links.map((l) => (l.id === id ? { ...l, stance } : l)) });
    try {
      await api(`/board/links/${id}`, { method: "PATCH", body: { stance, beforeId } });
    } catch (e) {
      void dialog.alert({ title: "Couldn't move the card", message: e instanceof Error ? e.message : "Please try again." });
    }
    await load();
  }

  async function assignCard(id: string, questionId: string | null) {
    try {
      await api(`/board/links/${id}`, { method: "PATCH", body: { questionId } });
    } catch (e) {
      void dialog.alert({ title: "Couldn't change the question", message: e instanceof Error ? e.message : "Please try again." });
    }
    await load();
  }

  async function removeCard(id: string) {
    const ok = await dialog.confirm({
      title: "Remove this card?",
      message: "It leaves the board. The highlight or source itself stays in your library.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/board/links/${id}`, { method: "DELETE" });
    } catch (e) {
      void dialog.alert({ title: "Couldn't remove the card", message: e instanceof Error ? e.message : "Please try again." });
    }
    await load();
  }

  if (!ready) return <LoadingScreen label="Loading your collections…" fill="page" />;
  if (!current) {
    return (
      <p className="text-sm text-slate-500">
        This collection doesn't exist or you don't have access to it.{" "}
        <Link to="/" className="font-semibold text-blue-700 hover:underline">Back to your library</Link>
      </p>
    );
  }
  if (error && !board) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!board) return <LoadingScreen label="Loading the evidence board…" fill="page" />;

  const visible = board.links.filter((l) => !questionFilter || l.questionId === questionFilter);
  const openCount = board.links.filter((l) => l.stance === "open").length;
  const filteredQuestion = board.questions.find((q) => q.id === questionFilter);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="btn-secondary mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to {current.name}
          </Link>
          <div className="eyebrow mb-2 text-blue-600">Research</div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Evidence board</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Arrange the evidence in {current.name} under what it supports, challenges, and still leaves open.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setAdding("supports")} className="btn-primary">
            <Plus className="size-4" /> Add evidence
          </button>
        )}
      </header>

      <QuestionsPanel
        collectionId={current.id}
        questions={board.questions}
        summaries={board.summaries}
        openCount={openCount}
        canEdit={canEdit}
        selected={questionFilter}
        onSelect={setQuestionFilter}
        onChanged={load}
      />

      {filteredQuestion && (
        <p className="text-xs text-slate-500">
          Showing evidence filed under <span className="font-semibold text-slate-700">“{filteredQuestion.text}”</span>.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const cards = visible.filter((l) => l.stance === col.stance);
          return (
            <section
              key={col.stance}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverColumn(col.stance);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId;
                setDragId(null);
                setOverColumn(null);
                if (id) void moveCard(id, col.stance, null);
              }}
              className={`flex min-h-48 min-w-0 flex-col rounded-2xl border p-3 transition ${
                overColumn === col.stance ? "border-blue-300 bg-blue-50/50" : "border-slate-200 bg-slate-50/70"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-ink">{col.label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.tone}`}>{cards.length}</span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setAdding(col.stance)}
                    aria-label={`Add to ${col.label}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-blue-700"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                {cards.map((link) => (
                  <EvidenceCard
                    key={link.id}
                    link={link}
                    questions={board.questions}
                    canEdit={canEdit}
                    dragging={dragId === link.id}
                    onDragStart={() => setDragId(link.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverColumn(null);
                    }}
                    onDropBefore={() => {
                      const id = dragId;
                      setDragId(null);
                      setOverColumn(null);
                      if (id) void moveCard(id, col.stance, link.id);
                    }}
                    onMove={(stance) => void moveCard(link.id, stance, null)}
                    onAssign={(questionId) => void assignCard(link.id, questionId)}
                    onRemove={() => void removeCard(link.id)}
                  />
                ))}
                {cards.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">{col.hint}</p>}
              </div>
            </section>
          );
        })}
      </div>

      <AddEvidenceModal
        open={adding !== null}
        onClose={() => setAdding(null)}
        collectionId={current.id}
        questions={board.questions}
        links={board.links}
        initialStance={adding ?? "supports"}
        initialQuestionId={questionFilter}
        onAdded={load}
      />
    </div>
  );
}