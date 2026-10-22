import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Field, Input, Select } from "@/components/ui";
import { DOC_TYPE_LABEL } from "@/lib/constants";
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
      <Field label="Tipo de documento" htmlFor={`doc_type_${entityId}`}>
        <Select id={`doc_type_${entityId}`} name="doc_type" defaultValue={types[0]}>
          {types.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" htmlFor={`starts_${entityId}`}>
          <Input id={`starts_${entityId}`} name="starts_on" type="date" />
        </Field>
        <Field label="Vence" htmlFor={`expires_${entityId}`}>
          <Input id={`expires_${entityId}`} name="expires_on" type="date" />
        </Field>
      </div>
      <FileUpload
        name="file"
        bucket="documents"
        folder={entity === "motorcycle" ? `moto/${entityId}` : entityId}
        kind="document"
        label="Foto o PDF"
      />
      <Field label="Notas" htmlFor={`notes_${entityId}`}>
        <Input id={`notes_${entityId}`} name="notes" placeholder="Ej: póliza 123, aseguradora…" />
      </Field>
    </ActionForm>
  );
}
