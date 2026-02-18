import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useAntiForgeryToken } from '@/hooks/useAntiForgeryToken';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api-client';
import { createAnnotation } from '@/services/annotations';
import { createIncident } from '@/services/incidents';
import { CasePriority } from '@/types';
import type { AnnotationCreatePayload, CaseCreatePayload } from '@/types';
import { validateFiles, type FileValidationError } from '@/utils/file-validation';

const SESSION_STORAGE_KEY = 'create-ticket-form';

interface CreateTicketFormValues {
  subject: string;
  casetypecode: string;
  description: string;
  prioritycode: string;
  attachments: File[];
}

const validationSchema = Yup.object({
  subject: Yup.string().required('Subject is required').max(300, 'Subject must be 300 characters or less'),
  casetypecode: Yup.string().required('Category is required'),
  description: Yup.string()
    .required('Description is required')
    .max(4000, 'Description must be 4000 characters or less'),
  prioritycode: Yup.string().optional(),
});

const CASE_TYPE_OPTIONS = [
  { value: '1', label: 'Billing' },
  { value: '2', label: 'Technical' },
  { value: '3', label: 'General Inquiry' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Failed to read attachment ${file.name}.`));
        return;
      }
      const base64 = reader.result.split(',')[1];
      if (!base64) {
        reject(new Error(`Failed to encode attachment ${file.name}.`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read attachment ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function getInitialValues(): CreateTicketFormValues {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return {
      subject: '',
      casetypecode: '',
      description: '',
      prioritycode: '',
      attachments: [],
    };
  }

  try {
    const saved = JSON.parse(raw) as Partial<CreateTicketFormValues>;
    return {
      subject: saved.subject ?? '',
      casetypecode: saved.casetypecode ?? '',
      description: saved.description ?? '',
      prioritycode: saved.prioritycode ?? '',
      attachments: [],
    };
  } catch {
    return {
      subject: '',
      casetypecode: '',
      description: '',
      prioritycode: '',
      attachments: [],
    };
  }
}

function persistForm(values: CreateTicketFormValues) {
  const payload = {
    subject: values.subject,
    casetypecode: values.casetypecode,
    description: values.description,
    prioritycode: values.prioritycode,
  };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function CreateTicket() {
  const navigate = useNavigate();
  const user = useAuth();
  const csrfToken = useAntiForgeryToken();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<FileValidationError[]>([]);

  const initialValues = useMemo(() => getInitialValues(), []);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Create a Support Ticket</Typography>

      {submitError && <ErrorBanner message={submitError} />}

      <Formik<CreateTicketFormValues>
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitError(null);

          const currentFileErrors = validateFiles(values.attachments);
          setFileErrors(currentFileErrors);
          if (currentFileErrors.length > 0) {
            setSubmitting(false);
            return;
          }

          if (!user) {
            const returnUrl = encodeURIComponent('/tickets/new');
            window.open(`/Account/Login/ExternalLogin?returnUrl=${returnUrl}`, '_self');
            setSubmitting(false);
            return;
          }

          if (!csrfToken) {
            setSubmitError('Unable to submit right now. Please refresh and try again.');
            setSubmitting(false);
            return;
          }

          const createPayload: CaseCreatePayload = {
            title: values.subject,
            description: values.description,
            casetypecode: Number(values.casetypecode),
            ...(values.prioritycode
              ? { prioritycode: Number(values.prioritycode) as CasePriority }
              : {}),
            'customerid_contact@odata.bind': `/contacts(${user.contactId})`,
          };

          try {
            const incidentId = await createIncident(createPayload, csrfToken);

            for (const file of values.attachments) {
              const documentbody = await fileToBase64(file);
              const annotationPayload: AnnotationCreatePayload = {
                filename: file.name,
                mimetype: file.type,
                documentbody,
                'objectid_incident@odata.bind': `/incidents(${incidentId})`,
              };
              await createAnnotation(annotationPayload, csrfToken);
            }

            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            navigate(`/tickets/${incidentId}/confirm`, {
              state: { ticketNumber: incidentId },
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              persistForm(values);
              const returnUrl = encodeURIComponent('/tickets/new');
              window.open(`/Account/Login/ExternalLogin?returnUrl=${returnUrl}`, '_self');
              return;
            }

            const message = error instanceof Error ? error.message : 'Failed to create ticket.';
            setSubmitError(message);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({
          values,
          errors,
          touched,
          isSubmitting,
          handleChange,
          handleBlur,
          setFieldValue,
        }) => (
          <Form noValidate>
            <Stack spacing={3}>
              <TextField
                label="Subject"
                name="subject"
                value={values.subject}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.subject && Boolean(errors.subject)}
                helperText={touched.subject ? errors.subject : ''}
                inputProps={{ maxLength: 300 }}
                fullWidth
              />

              <TextField
                select
                SelectProps={{ native: true }}
                label="Category"
                name="casetypecode"
                value={values.casetypecode}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.casetypecode && Boolean(errors.casetypecode)}
                helperText={touched.casetypecode ? errors.casetypecode : ''}
                fullWidth
              >
                <option value="">Select a category</option>
                {CASE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>

              <TextField
                label="Description"
                name="description"
                value={values.description}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.description && Boolean(errors.description)}
                helperText={touched.description ? errors.description : ''}
                multiline
                minRows={5}
                inputProps={{ maxLength: 4000 }}
                fullWidth
              />

              <TextField
                select
                SelectProps={{ native: true }}
                label="Priority (optional)"
                name="prioritycode"
                value={values.prioritycode}
                onChange={handleChange}
                onBlur={handleBlur}
                fullWidth
              >
                <option value="">No preference</option>
                <option value={String(CasePriority.High)}>High</option>
                <option value={String(CasePriority.Normal)}>Normal</option>
                <option value={String(CasePriority.Low)}>Low</option>
              </TextField>

              <Box component="section">
                <Typography variant="subtitle2" component="label" htmlFor="attachments-input" display="block" mb={1}>
                  <span id="attachments-heading">Attachments</span>
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Up to 3 files, 10 MB maximum each.
                </Typography>
                <input
                  id="attachments-input"
                  aria-label="Attachments"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    setFieldValue('attachments', files);
                    setFileErrors(validateFiles(files));
                  }}
                />
                <Box aria-live="polite">
                  {fileErrors.map((error, index) => (
                    <Typography key={`${error.code}-${error.fileName ?? ''}-${index}`} color="error" variant="body2">
                      {error.code === 'TOO_MANY_FILES' ? 'You can upload a maximum of 3 files.' : error.message}
                    </Typography>
                  ))}
                </Box>
              </Box>

              <Box display="flex" gap={2}>
                <Button type="submit" variant="contained" disabled={isSubmitting} aria-label="Submit ticket">
                  Submit Ticket
                </Button>
                <Button type="button" variant="outlined" onClick={() => navigate('/')} aria-label="Cancel ticket creation">
                  Cancel
                </Button>
              </Box>
            </Stack>
          </Form>
        )}
      </Formik>
    </Stack>
  );
}
