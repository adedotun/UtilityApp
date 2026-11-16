import {
  PDFButton, PDFCheckBox, PDFDocument, PDFDropdown, PDFName, PDFDict,
  PDFOptionList, PDFRadioGroup, PDFSignature, PDFTextField,
  type PDFField,
} from 'pdf-lib'

export type FormFieldType = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'option-list' | 'button' | 'signature' | 'unknown'

export interface FormFieldInfo {
  name: string
  type: FormFieldType
  /** Current value: text for text fields, a boolean for checkboxes, the selected option(s) for choice fields. */
  value: string | boolean | string[]
  options?: string[]
  multiline?: boolean
  /** False for fields a browser cannot fill (signature and button fields). */
  editable: boolean
}

function describeField(field: PDFField): FormFieldInfo {
  const name = field.getName()
  if (field instanceof PDFTextField) {
    return { name, type: 'text', value: field.getText() ?? '', multiline: field.isMultiline(), editable: true }
  }
  if (field instanceof PDFCheckBox) {
    return { name, type: 'checkbox', value: field.isChecked(), editable: true }
  }
  if (field instanceof PDFDropdown) {
    return { name, type: 'dropdown', value: field.getSelected(), options: field.getOptions(), editable: true }
  }
  if (field instanceof PDFRadioGroup) {
    return { name, type: 'radio', value: field.getSelected() ?? '', options: field.getOptions(), editable: true }
  }
  if (field instanceof PDFOptionList) {
    return { name, type: 'option-list', value: field.getSelected(), options: field.getOptions(), editable: true }
  }
  if (field instanceof PDFButton) return { name, type: 'button', value: '', editable: false }
  if (field instanceof PDFSignature) return { name, type: 'signature', value: '', editable: false }
  return { name, type: 'unknown', value: '', editable: false }
}

/**
 * XFA forms (common in older government documents) carry an XFA entry in
 * the AcroForm dictionary. Their fields are not standard AcroForm fields,
 * so pdf-lib cannot see or fill them; detecting the entry lets the tool
 * say so instead of claiming the form has no fields. Note that pdf-lib's
 * own getForm() deletes this entry on first access, so it must be read
 * from the loaded document before getForm() is called.
 */
export function hasXfaForm(doc: PDFDocument): boolean {
  const acro = doc.catalog.lookup(PDFName.of('AcroForm'))
  return acro instanceof PDFDict && acro.get(PDFName.of('XFA')) !== undefined
}

export interface FormInfo { fields: FormFieldInfo[]; hasXfa: boolean }

export async function listFormFields(buffer: ArrayBuffer): Promise<FormInfo> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  // The XFA check must come first: pdf-lib's getForm() deletes the XFA
  // entry (it cannot work with XFA), so checking afterwards would always
  // report false.
  const hasXfa = hasXfaForm(doc)
  const form = doc.getForm()
  return { fields: form.getFields().map(describeField), hasXfa }
}

export type FormValues = Record<string, string | boolean>

export interface FillResult { data: Uint8Array; filledCount: number }

/**
 * Writes the given values into the form's fields. Choice fields are
 * validated against their own options so a bad value fails with the field
 * named, not a library error. With `flatten`, the filled fields are baked
 * into the pages afterwards and can no longer be edited.
 */
export async function fillForm(buffer: ArrayBuffer, values: FormValues, options: { flatten?: boolean } = {}): Promise<FillResult> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const form = doc.getForm()
  let filledCount = 0
  for (const [name, value] of Object.entries(values)) {
    let field: PDFField
    try {
      field = form.getField(name)
    } catch {
      throw new Error(`The form has no field called "${name}".`)
    }
    if (field instanceof PDFTextField) {
      field.setText(String(value))
      filledCount++
    } else if (field instanceof PDFCheckBox) {
      if (value) field.check(); else field.uncheck()
      filledCount++
    } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList) {
      const choice = String(value)
      if (choice === '') continue // left unchosen on purpose
      if (!field.getOptions().includes(choice)) {
        throw new Error(`"${choice}" is not one of the choices for the field "${name}".`)
      }
      field.select(choice as never)
      filledCount++
    }
    // Button, signature and unknown fields cannot be filled; they are not
    // counted and the caller never offers inputs for them.
  }
  if (filledCount === 0) throw new Error('Fill in at least one field before saving.')
  if (options.flatten) form.flatten()
  return { data: await doc.save(), filledCount }
}
