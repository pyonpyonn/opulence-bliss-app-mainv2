"use client";

import { useActionState, useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import type { LegalDocument } from "@/lib/legalDocuments";
import { saveLegalDocument, type LegalSaveState } from "./actions";
import styles from "./page.module.css";

const INITIAL_STATE: LegalSaveState = { ok: false, message: "" };

export default function LegalEditor({ document }: { document: LegalDocument }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(document.contentHtml);
  const [state, action, pending] = useActionState(saveLegalDocument, INITIAL_STATE);

  function command(name: string, value?: string) {
    editorRef.current?.focus();
    documentExec(name, value);
    setHtml(editorRef.current?.innerHTML ?? "");
  }

  return (
    <form action={action} className={styles.editorCard}>
      <input type="hidden" name="slug" value={document.slug} />
      <input type="hidden" name="contentHtml" value={html} />

      <div className={styles.editorHeading}>
        <div>
          <span>{document.audience}</span>
          <h2>{document.title}</h2>
        </div>
        {document.isFallback && <b className={styles.draft}>Using starter draft</b>}
      </div>

      <div className={styles.fields}>
        <label>
          Document title
          <input name="title" defaultValue={document.title} maxLength={120} required />
        </label>
        <label>
          Version
          <input
            name="version"
            defaultValue={document.version}
            pattern="(?:\d{4}-\d{2}-\d{2}(?:\.\d+)?|\d+\.\d+)"
            required
          />
        </label>
      </div>

      <div className={styles.toolbar} role="toolbar" aria-label={`Format ${document.title}`}>
        <select
          aria-label="Text size"
          defaultValue="p"
          onChange={(event) => command("formatBlock", event.target.value)}
        >
          <option value="p">Normal text</option>
          <option value="h2">Large heading</option>
          <option value="h3">Small heading</option>
        </select>
        <ToolbarButton label="Bold" onPress={() => command("bold")}><Bold size={17} /></ToolbarButton>
        <ToolbarButton label="Italic" onPress={() => command("italic")}><Italic size={17} /></ToolbarButton>
        <ToolbarButton label="Bulleted list" onPress={() => command("insertUnorderedList")}><List size={17} /></ToolbarButton>
        <ToolbarButton label="Numbered list" onPress={() => command("insertOrderedList")}><ListOrdered size={17} /></ToolbarButton>
        <ToolbarButton
          label="Add link"
          onPress={() => {
            const url = window.prompt("Paste the full link address");
            if (url) command("createLink", url);
          }}
        ><Link2 size={17} /></ToolbarButton>
        <span className={styles.toolbarSpacer} />
        <ToolbarButton label="Undo" onPress={() => command("undo")}><Undo2 size={17} /></ToolbarButton>
        <ToolbarButton label="Redo" onPress={() => command("redo")}><Redo2 size={17} /></ToolbarButton>
      </div>

      <div
        ref={editorRef}
        className={styles.richEditor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={`${document.title} content`}
        onInput={(event) => setHtml(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: document.contentHtml }}
      />

      <div className={styles.editorFooter}>
        <span>Saving publishes this version on the website.</span>
        <button className={styles.saveButton} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save document"}
        </button>
      </div>
      {state.message && (
        <p className={state.ok ? styles.success : styles.error} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

function ToolbarButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onPress();
      }}
    >
      {children}
    </button>
  );
}

function documentExec(command: string, value?: string) {
  document.execCommand(command, false, value);
}
