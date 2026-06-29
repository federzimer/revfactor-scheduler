'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from '../AdminHeader';

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
}

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  sortOrder: number;
}

const inputStyle = { backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' } as const;

export default function FaqPage() {
  const { status } = useSession();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Faq | null>(null); // existing FAQ being edited
  const [adding, setAdding] = useState(false); // add form open

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const [faqRes, resRes] = await Promise.all([fetch('/api/faq'), fetch('/api/resources')]);
        const faqData = await faqRes.json();
        const resData = await resRes.json();
        setFaqs(faqData.faqs || []);
        setResources(resData.resources || []);
        setCanEdit(!!faqData.canEdit);
      } catch {
        setError('Failed to load FAQs');
      }
      setLoading(false);
    })();
  }, [status]);

  // Group by category, preserving the API's ordering.
  const grouped = useMemo(() => {
    const map = new Map<string, Faq[]>();
    for (const f of faqs) {
      const key = f.category?.trim() || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries());
  }, [faqs]);

  const upsertLocal = (f: Faq) => {
    setFaqs((prev) => {
      const exists = prev.some((x) => x.id === f.id);
      const next = exists ? prev.map((x) => (x.id === f.id ? f : x)) : [...prev, f];
      return next.sort((a, b) =>
        (a.category || 'General').localeCompare(b.category || 'General') ||
        a.sortOrder - b.sortOrder,
      );
    });
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return;
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    await fetch('/api/faq', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E0DAD1' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#13352F' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E0DAD1' }}>
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8 lg:items-start">
          {/* FAQ column */}
          <div className="space-y-6 min-w-0">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#9CA3AF' }}>Sales playbook</h2>
                <h3 className="text-2xl font-semibold" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  Rep <span style={{ fontStyle: 'italic', color: '#13352F' }}>FAQ</span>
                </h3>
                <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Quick answers and talking points for sales calls.</p>
              </div>
              {canEdit && !adding && (
                <button
                  onClick={() => { setAdding(true); setEditing(null); }}
                  className="text-white px-4 py-2 rounded-md text-sm font-medium flex-shrink-0"
                  style={{ backgroundColor: '#13352F' }}
                >
                  + Add FAQ
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>{error}</div>
            )}

            {canEdit && adding && (
              <FaqForm
                onCancel={() => setAdding(false)}
                onSaved={(f) => { upsertLocal(f); setAdding(false); }}
              />
            )}

            {faqs.length === 0 && !adding ? (
              <div className="rounded-xl shadow-sm p-8 text-center" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  No FAQs yet.{canEdit ? ' Click “Add FAQ” to create the first one.' : ' Check back soon.'}
                </p>
              </div>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: '#9CA3AF' }}>{category}</h4>
                  <div className="space-y-2">
                    {items.map((f) =>
                      editing?.id === f.id ? (
                        <FaqForm
                          key={f.id}
                          initial={f}
                          onCancel={() => setEditing(null)}
                          onSaved={(updated) => { upsertLocal(updated); setEditing(null); }}
                        />
                      ) : (
                        <div key={f.id} className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
                          <button
                            onClick={() => setOpenId((cur) => (cur === f.id ? null : f.id))}
                            className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3"
                          >
                            <span className="text-sm font-medium" style={{ color: '#181915' }}>{f.question}</span>
                            <svg
                              className="w-4 h-4 flex-shrink-0 transition-transform"
                              style={{ color: '#9CA3AF', transform: openId === f.id ? 'rotate(180deg)' : 'none' }}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {openId === f.id && (
                            <div className="px-5 pb-4 -mt-1">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#4B5563' }}>{f.answer}</p>
                              {canEdit && (
                                <div className="flex gap-3 mt-3">
                                  <button onClick={() => { setEditing(f); setOpenId(null); }} className="text-xs font-medium" style={{ color: '#13352F' }}>Edit</button>
                                  <button onClick={() => remove(f.id)} className="text-xs font-medium" style={{ color: '#b91c1c' }}>Delete</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resources side panel */}
          <aside className="mt-8 lg:mt-0 lg:sticky lg:top-8">
            <ResourcesPanel
              resources={resources}
              setResources={setResources}
              canEdit={canEdit}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

function FaqForm({ initial, onCancel, onSaved }: { initial?: Faq; onCancel: () => void; onSaved: (f: Faq) => void }) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!question.trim() || !answer.trim()) { setErr('Question and answer are required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/faq', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initial?.id, question, answer, category, sortOrder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved(data.faq);
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl shadow-sm p-5 space-y-3" style={{ backgroundColor: '#F5F4F2', border: '1px solid #13352F' }}>
      {err && <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>{err}</div>}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Question</label>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="What does the owner usually ask?" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Answer</label>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className="w-full rounded-md px-3 py-2 text-sm outline-none resize-y" style={inputStyle} placeholder="The answer / talking point for reps." />
      </div>
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="e.g. Pricing, Objections, Onboarding" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} title="Lower numbers show first within a category" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 rounded-md text-sm" style={{ color: '#6B7280', border: '1px solid #E5E4E0', backgroundColor: 'white' }}>Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: '#13352F', color: 'white', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ResourcesPanel({
  resources,
  setResources,
  canEdit,
}: {
  resources: Resource[];
  setResources: React.Dispatch<React.SetStateAction<Resource[]>>;
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const upsertLocal = (r: Resource) => {
    setResources((prev) => {
      const exists = prev.some((x) => x.id === r.id);
      const next = exists ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this resource?')) return;
    setResources((prev) => prev.filter((r) => r.id !== id));
    await fetch('/api/resources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  return (
    <div className="rounded-xl shadow-sm p-4" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Resources</h4>
        {canEdit && !adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="text-xs font-medium"
            style={{ color: '#13352F' }}
          >
            + Add
          </button>
        )}
      </div>

      <p className="text-xs mb-3 leading-relaxed" style={{ color: '#6B7280' }}>
        Files to share with owners — contract, service agreement, decks.
      </p>

      {canEdit && adding && (
        <div className="mb-3">
          <ResourceForm
            onCancel={() => setAdding(false)}
            onSaved={(r) => { upsertLocal(r); setAdding(false); }}
          />
        </div>
      )}

      {resources.length === 0 && !adding ? (
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          {canEdit ? 'No files yet. Add the service agreement link with “+ Add”.' : 'No files yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {resources.map((r) =>
            editingId === r.id ? (
              <ResourceForm
                key={r.id}
                initial={r}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => { upsertLocal(updated); setEditingId(null); }}
              />
            ) : (
              <div key={r.id} className="rounded-lg p-3" style={{ backgroundColor: 'white', border: '1px solid #E5E4E0' }}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 group"
                >
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#13352F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
                  </svg>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium underline-offset-2 group-hover:underline" style={{ color: '#181915' }}>{r.title}</span>
                    {r.description && <span className="block text-xs mt-0.5" style={{ color: '#6B7280' }}>{r.description}</span>}
                  </span>
                </a>
                {canEdit && (
                  <div className="flex gap-3 mt-2 pl-6">
                    <button onClick={() => { setEditingId(r.id); setAdding(false); }} className="text-xs font-medium" style={{ color: '#13352F' }}>Edit</button>
                    <button onClick={() => remove(r.id)} className="text-xs font-medium" style={{ color: '#b91c1c' }}>Remove</button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ResourceForm({ initial, onCancel, onSaved }: { initial?: Resource; onCancel: () => void; onSaved: (r: Resource) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim() || !url.trim()) { setErr('Title and link are required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/resources', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initial?.id, title, description, url, sortOrder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved(data.resource);
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'white', border: '1px solid #13352F' }}>
      {err && <div className="rounded-md px-2 py-1.5 text-xs" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>{err}</div>}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none" style={inputStyle} placeholder="e.g. Service Agreement" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Link</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none" style={inputStyle} placeholder="https://drive.google.com/…" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Note <span style={{ color: '#9CA3AF' }}>(optional)</span></label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none" style={inputStyle} placeholder="e.g. Standard $350/mo agreement" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Order</label>
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} className="w-20 rounded-md px-2.5 py-1.5 text-sm outline-none" style={inputStyle} title="Lower numbers show first" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 rounded-md text-xs" style={{ color: '#6B7280', border: '1px solid #E5E4E0', backgroundColor: 'white' }}>Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#13352F', color: 'white', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
