"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/actions/admin";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
const initialActionState: ActionState = { status: "idle" };

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Speichern",
  destructive = false,
  encType,
}: {
  action: Action;
  children?: React.ReactNode;
  className?: string;
  submitLabel?: string;
  destructive?: boolean;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className={className} encType={encType}>
      {children}
      <button
        type="submit"
        disabled={pending}
        className={destructive ? "admin-button danger" : "admin-button"}
      >
        {pending ? "Bitte warten …" : submitLabel}
      </button>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`admin-feedback ${state.status}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function SearchForm({
  action,
  label,
  placeholder,
  selectionAction,
  selectionLabel = "Auswählen",
}: {
  action: Action;
  label: string;
  placeholder: string;
  selectionAction?: Action;
  selectionLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  return (
    <div className="admin-search">
      <form action={formAction}>
        <label>
          <span>{label}</span>
          <div className="admin-search-row">
            <input name="query" type="search" required placeholder={placeholder} />
            <button className="admin-button" disabled={pending}>
              {pending ? "Suche …" : "Suchen"}
            </button>
          </div>
        </label>
      </form>
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={`admin-feedback ${state.status}`}>
          {state.message}
        </p>
      ) : null}
      {state.results?.length ? (
        <ul className="search-results">
          {state.results.map((result) => (
            <li key={result.id}>
              <div>
                <strong>{result.title}</strong>
                <span>{result.subtitle}</span>
              </div>
              {selectionAction ? (
                <ActionForm action={selectionAction} submitLabel={selectionLabel}>
                  {Object.entries(result.values ?? {}).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                  ))}
                </ActionForm>
              ) : (
                <code>{result.id}</code>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
