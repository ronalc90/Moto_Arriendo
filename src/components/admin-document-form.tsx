import { ActionForm } from "@/components/action-form";
import { DocumentUploadFields } from "@/components/document-upload-fields";
import { Field, Input } from "@/components/ui";
import { addDocument } from "@/app/admin/documents-actions";

const MOTO_TYPES = ["soat", "insurance", "tech_inspection", "registration", "other"];
const DRIVER_TYPES = ["license", "national_id", "background_check", "contract", "other"];

/** Upload form for motorcycle or driver documents (admin). */
export function AdminDocumentForm({ entity, entityId }: { entity: "motorcycle" | "driver"; entityId: string }) {
  const types = entity === "motorcycle" ? MOTO_TYPES : DRIVER_TYPES;
  return (
    <ActionForm action={addDocument} submitLabel="Guardar documento" submitSize="md" resetOnSuccess>
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="entity_id" value={entityId} />
      <DocumentUploadFields
        types={types}
        folder={entity === "motorcycle" ? `moto/${entityId}` : entityId}
        idPrefix={`doc_${entityId}`}
        showStart
        requireFile={false}
      />
      <Field label="Notas" htmlFor={`notes_${entityId}`}>
        <Input id={`notes_${entityId}`} name="notes" placeholder="Ej: póliza 123, aseguradora…" />
      </Field>
    </ActionForm>
  );
}
