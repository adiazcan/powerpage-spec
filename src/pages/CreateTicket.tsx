import { useMemo, useState } from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useAntiForgeryToken } from '@/hooks/useAntiForgeryToken';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api-client';
import { createAnnotation } from '@/services/annotations';
import { createIncident } from '@/services/incidents';
import { CasePriority } from '@/types';
import type { AnnotationCreatePayload, CaseCreatePayload } from '@/types';
import { validateFiles, type FileValidationError } from '@/utils/file-validation';
import './create-ticket.css';

const iconBack = '/assets/create-ticket/icon-back.svg';
const iconTitle = '/assets/create-ticket/icon-title.svg';
const iconTell = '/assets/create-ticket/icon-tell.svg';
const iconContact = '/assets/create-ticket/icon-contact.svg';
const iconAccount = '/assets/create-ticket/icon-account.svg';
const iconNext = '/assets/create-ticket/icon-next.svg';
const iconPortal = '/assets/create-ticket/icon-portal.svg';
const iconDashboard = '/assets/create-ticket/icon-dashboard.svg';
const iconTickets = '/assets/create-ticket/icon-tickets.svg';
const iconNew = '/assets/create-ticket/icon-new.svg';
const iconSearch = '/assets/create-ticket/icon-search.svg';
const iconBell = '/assets/create-ticket/icon-bell.svg';

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

function isGenericDataverseCreateError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 400 && error.code === '9004010D';
}

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function CreateTicket() {
  const navigate = useNavigate();
  const user = useAuth();
  const csrfToken = useAntiForgeryToken();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<FileValidationError[]>([]);

  const initialValues = useMemo(() => getInitialValues(), []);
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Portal User';
  const accountLabel = user?.accountId ?? 'No account linked';
  const initials = initialsFromName(fullName);

  return (
    <div className="ct-shell" data-node-id="1:873">
      <aside className="ct-sidebar">
        <div className="ct-sidebar-brand">
          <div className="ct-sidebar-logo-wrap">
            <img src={iconPortal} alt="Portal" />
          </div>
          <div>
            <p className="ct-brand-title">Support Portal</p>
            <p className="ct-brand-subtitle">Dynamics 365</p>
          </div>
        </div>

        <div className="ct-divider" />

        <nav className="ct-sidebar-nav" aria-label="Primary">
          <Link className="ct-nav-link" to="/">
            <img src={iconDashboard} alt="" />
            <span>Dashboard</span>
          </Link>
          <Link className="ct-nav-link" to="/tickets">
            <img src={iconTickets} alt="" />
            <span>My Tickets</span>
          </Link>
          <Link className="ct-nav-link ct-nav-link-active" to="/tickets/new" aria-current="page">
            <img src={iconNew} alt="" />
            <span>New Ticket</span>
          </Link>
        </nav>

        <div className="ct-divider" />

        <div className="ct-sidebar-user">
          <div className="ct-avatar">{initials}</div>
          <div>
            <p className="ct-user-name">{fullName}</p>
            <p className="ct-user-org">{accountLabel}</p>
          </div>
        </div>
      </aside>

      <main className="ct-main">
        <header className="ct-header">
          <div className="ct-header-grow" />
          <button className="ct-icon-btn" type="button" aria-label="Search">
            <img src={iconSearch} alt="" />
          </button>
          <button className="ct-icon-btn ct-icon-btn-bell" type="button" aria-label="Notifications">
            <img src={iconBell} alt="" />
            <span className="ct-notification-dot" />
          </button>
          <div className="ct-header-divider" />
          <div className="ct-header-user">
            <div className="ct-avatar ct-avatar-sm">{initials}</div>
            <span>{fullName}</span>
          </div>
        </header>

        <div className="ct-page">
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
          };

          try {
            let incidentId: string;

            try {
              incidentId = await createIncident(createPayload, csrfToken);
            } catch (error) {
              if (!isGenericDataverseCreateError(error) || !user.contactId) {
                throw error;
              }

              const fallbackPayload: CaseCreatePayload = {
                ...createPayload,
                'customerid_contact@odata.bind': `/contacts(${user.contactId})`,
              };
              incidentId = await createIncident(fallbackPayload, csrfToken);
            }

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
          <Form noValidate className="ct-form-root">
            <div className="ct-top-row">
              <Link className="ct-back-link" to="/tickets" aria-label="Back to My Tickets">
                <img src={iconBack} alt="" />
                <span>Back to My Tickets</span>
              </Link>
            </div>

            <div className="ct-title-row">
              <div className="ct-title-icon-wrap">
                <img src={iconTitle} alt="" />
              </div>
              <div>
                <h1>Create New Ticket</h1>
                <p>Submit a new service request to our support team</p>
              </div>
            </div>

            <section className="ct-card">
              <div className="ct-card-intro">
                <div className="ct-card-intro-title">
                  <img src={iconTell} alt="" />
                  <span>Tell us about your issue</span>
                </div>
                <p>
                  Provide a clear subject and detailed description to help us resolve your issue faster.
                </p>
              </div>

              {submitError && <ErrorBanner message={submitError} />}

              <div className="ct-fields">
                <div className="ct-field">
                  <label htmlFor="subject">
                    Subject <span className="ct-required">*</span>
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    value={values.subject}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={300}
                    placeholder="Brief summary of your issue..."
                    aria-invalid={touched.subject && Boolean(errors.subject)}
                  />
                  {touched.subject && errors.subject && <p className="ct-error">{errors.subject}</p>}
                </div>

                <div className="ct-field">
                  <label htmlFor="description">
                    Description <span className="ct-required">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={values.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={4000}
                    placeholder="Describe your issue in detail. Include steps to reproduce, expected behavior, and any error messages..."
                    aria-invalid={touched.description && Boolean(errors.description)}
                  />
                  <p className="ct-hint">{values.description.length} characters</p>
                  {touched.description && errors.description && (
                    <p className="ct-error">{errors.description}</p>
                  )}
                </div>

                <div className="ct-classification-grid">
                  <div className="ct-field">
                    <label htmlFor="casetypecode">
                      Category <span className="ct-required">*</span>
                    </label>
                    <select
                      id="casetypecode"
                      name="casetypecode"
                      value={values.casetypecode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      aria-invalid={touched.casetypecode && Boolean(errors.casetypecode)}
                    >
                      <option value="">Select a category</option>
                      {CASE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {touched.casetypecode && errors.casetypecode && (
                      <p className="ct-error">{errors.casetypecode}</p>
                    )}
                  </div>

                  <div className="ct-field">
                    <label htmlFor="prioritycode">Priority (optional)</label>
                    <select
                      id="prioritycode"
                      name="prioritycode"
                      value={values.prioritycode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    >
                      <option value="">No preference</option>
                      <option value={String(CasePriority.High)}>High</option>
                      <option value={String(CasePriority.Normal)}>Normal</option>
                      <option value={String(CasePriority.Low)}>Low</option>
                    </select>
                  </div>
                </div>

                <div className="ct-field">
                  <label htmlFor="attachments-input">Attachments</label>
                  <p className="ct-hint">Up to 3 files, 10 MB maximum each.</p>
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
                  <div aria-live="polite">
                    {fileErrors.map((error, index) => (
                      <p key={`${error.code}-${error.fileName ?? ''}-${index}`} className="ct-error">
                        {error.code === 'TOO_MANY_FILES'
                          ? 'You can upload a maximum of 3 files.'
                          : error.message}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="ct-contact-split">
                  <p>Contact Information (auto-filled)</p>
                  <div className="ct-contact-grid">
                    <div className="ct-contact-tile">
                      <img src={iconContact} alt="" />
                      <div>
                        <span>Contact</span>
                        <strong>{fullName}</strong>
                      </div>
                    </div>
                    <div className="ct-contact-tile">
                      <img src={iconAccount} alt="" />
                      <div>
                        <span>Account</span>
                        <strong>{accountLabel}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ct-actions">
                <button
                  type="button"
                  className="ct-cancel"
                  onClick={() => navigate('/tickets')}
                  aria-label="Cancel ticket creation"
                >
                  Cancel
                </button>
                <button type="submit" className="ct-next" disabled={isSubmitting} aria-label="Submit ticket">
                  <span>Submit Ticket</span>
                  <img src={iconNext} alt="" />
                </button>
              </div>
            </section>
          </Form>
        )}
      </Formik>
        </div>
      </main>
    </div>
  );
}
