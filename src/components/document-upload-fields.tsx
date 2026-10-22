"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Field, Input, Select } from "@/components/ui";
import { DOC_TYPE_LABEL } from "@/lib/constants";

/** Documents that must be photographed on both sides. */
export const TWO_SIDED = ["national_id", "license"];

/**
 * Type + dates + photo(s) of a document. Cédula and license ask for the front
 * and the back. Photos are checked on the phone (sharp, bright, big enough).
 */
export function DocumentUploadFields({
  types,
  folder,
  idPrefix,
  showStart = false,
  requireFile = true,
}: {
  types: string[];
  folder: string;
  idPrefix: string;
  showStart?: boolean;
  /** Admins may register just the expiry date of a motorcycle document. */
  requireFile?: boolean;
}) {
  const [type, setType] = useState(types[0]);
  const twoSided = TWO_SIDED.includes(type);
  return (
    <>
      <Field label="Tipo de documento" htmlFor={`${idPrefix}_type`}>
        <Select id={`${idPrefix}_type`} name="doc_type" value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t] ?? t}
            </option>
          ))}
        </Select>
      </Field>
      <div className={showStart ? "grid grid-cols-2 gap-3" : ""}>
        {showStart ? (
          <Field label="Desde" htmlFor={`${idPrefix}_starts`}>
            <Input id={`${idPrefix}_starts`} name="starts_on" type="date" />
          </Field>
        ) : null}
        <Field label="Vence (si tiene)" htmlFor={`${idPrefix}_expires`}>
          <Input id={`${idPrefix}_expires`} name="expires_on" type="date" />
        </Field>
      </div>
      <FileUpload
        key={`${type}-front`}
        name="file"
        bucket="documents"
        folder={folder}
        kind="document"
        capture
        checkQuality
        required={requireFile || twoSided}
        label={twoSided ? "Foto del FRENTE" : "Foto o PDF del documento"}
      />
      {twoSided ? (
        <FileUpload
          key={`${type}-back`}
          name="back_file"
          bucket="documents"
          folder={folder}
          kind="document"
          capture
          checkQuality
          required
          label="Foto del REVERSO"
        />
      ) : null}
      <p className="text-xs text-ink-3">
        Pon el documento sobre una mesa, con buena luz y sin flash. Que se vea completo y se puedan leer los números.
      </p>
    </>
  );
}
