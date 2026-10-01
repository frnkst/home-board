import Link from "next/link";

import { ActionForm } from "@/components/admin/ActionForm";
import {
  deleteResource,
  moveResource,
  type ActionState,
} from "@/lib/actions/admin";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="admin-page-header">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

export function Fields({ children }: { children: React.ReactNode }) {
  return <div className="admin-fields">{children}</div>;
}

export function Toggle({
  defaultChecked = true,
}: {
  defaultChecked?: boolean;
}) {
  return (
    <label className="admin-toggle">
      <input name="enabled" type="checkbox" defaultChecked={defaultChecked} />
      <span>Auf dem Board anzeigen</span>
    </label>
  );
}

export function ItemActions({
  id,
  resource,
  canMoveUp,
  canMoveDown,
}: {
  id: string;
  resource:
    | "countdowns"
    | "market_symbols"
    | "photos"
    | "webpages"
    | "custom_texts"
    | "playlist_entries";
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="admin-item-actions" aria-label="Reihenfolge">
      {canMoveUp ? (
        <ActionForm action={moveResource} submitLabel="↑ Hoch">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="resource" value={resource} />
          <input type="hidden" name="direction" value="up" />
        </ActionForm>
      ) : null}
      {canMoveDown ? (
        <ActionForm action={moveResource} submitLabel="↓ Runter">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="resource" value={resource} />
          <input type="hidden" name="direction" value="down" />
        </ActionForm>
      ) : null}
    </div>
  );
}

export function DeleteResource({
  id,
  resource,
}: {
  id: string;
  resource: "events" | "countdowns" | "market_symbols" | "webpages" | "custom_texts" | "playlist_entries";
}) {
  return (
    <ActionForm action={deleteResource} submitLabel="Löschen" destructive>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="resource" value={resource} />
    </ActionForm>
  );
}

export function SectionLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link className="admin-section-link" href={href}>
      <span>{title}</span>
      <small>{detail}</small>
      <b aria-hidden>→</b>
    </Link>
  );
}

export type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;
