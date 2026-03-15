'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ChevronRightIcon,
  DocumentIcon,
  CubeIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Listbox, Tab, Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

type TreeNode = {
  name: string;
  fullPath?: string;
  children: Record<string, TreeNode>;
};

function buildTree(keys: string[]) {
  const root: TreeNode = { name: 'root', children: {} };
  for (const key of keys) {
    const parts = key.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children[part]) {
        current.children[part] = { name: part, children: {} };
      }
      current = current.children[part];
    }
    current.fullPath = key;
  }
  return root;
}

const explorerOptions = [{ id: 'default', label: 'etcd Explorer' }];

function TreeItem({
  node,
  onSelect,
  selectedKey,
  forceExpanded = false,
}: {
  node: TreeNode;
  onSelect: (key: string) => void;
  selectedKey: string | null;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(forceExpanded);
  const childKeys = Object.keys(node.children).sort();
  const hasChildren = childKeys.length > 0;
  const isExpanded = forceExpanded || expanded;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren && !forceExpanded) setExpanded(!expanded);
    if (node.fullPath) onSelect(node.fullPath);
  };

  if (node.name === 'root') {
    return (
      <div className="pb-5">
        {childKeys.map((k) => (
          <TreeItem key={k} node={node.children[k]} onSelect={onSelect} selectedKey={selectedKey} forceExpanded={forceExpanded} />
        ))}
      </div>
    );
  }

  const isSelected = selectedKey === node.fullPath;

  return (
    <div className="relative ml-3">
      <div
        className={`flex items-center py-2 px-3 rounded-md cursor-pointer transition-all duration-200 text-sm mb-0.5 select-none border-l-[3px] ${
          isSelected
            ? 'bg-violet-500/15 text-violet-400 border-l-violet-500'
            : 'text-gray-400 border-l-transparent hover:bg-white/5 hover:text-gray-200 hover:translate-x-1'
        }`}
        onClick={handleClick}
      >
        <span className={`mr-2 inline-flex shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
          {hasChildren ? (
            <ChevronRightIcon className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <DocumentIcon className="w-4 h-4" strokeWidth={1.5} />
          )}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      {isExpanded && hasChildren && (
        <div className="tree-children">
          {childKeys.map((k) => (
            <TreeItem key={k} node={node.children[k]} onSelect={onSelect} selectedKey={selectedKey} forceExpanded={forceExpanded} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [valueBase64, setValueBase64] = useState('');
  const [viewMode, setViewMode] = useState<'raw' | 'yaml'>('yaml');
  const [yamlValue, setYamlValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keySearch, setKeySearch] = useState('');
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(400);

  const fetchKeys = () => {
    setLoading(true);
    fetch('/api/etcd/keys')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          if (data.error && data.error.includes('not configured')) {
            router.push('/setup');
          } else {
            showToast(`Failed to fetch keys: ${data.error}`, 'error');
          }
        } else {
          if (data.keys) setKeys(data.keys);
        }
        setLoading(false);
      })
      .catch((e) => {
        showToast(`Failed to fetch keys: ${e.message}`, 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Measure editor container so Monaco gets a pixel height and fills the area
  useEffect(() => {
    const el = editorWrapRef.current;
    if (!el || viewMode !== 'yaml') return;
    const updateHeight = () => {
      let h = el.clientHeight;
      if (h <= 0 && el.parentElement) h = el.parentElement.clientHeight;
      if (h <= 0 && el.offsetParent instanceof HTMLElement) h = el.offsetParent.clientHeight;
      setEditorHeight(Math.max(200, h || 400));
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    const t1 = setTimeout(updateHeight, 50);
    const t2 = setTimeout(updateHeight, 200);
    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selectedKey, viewMode]);

  const filteredKeys = useMemo(() => {
    const q = keySearch.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.toLowerCase().includes(q));
  }, [keys, keySearch]);

  const tree = useMemo(() => buildTree(filteredKeys), [filteredKeys]);

  useEffect(() => {
    if (viewMode === 'yaml' && !yamlValue && valueBase64) {
      setYamlValue('Decoding YAML...');
      fetch('/api/etcd/yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueBase64 }),
      })
        .then((r) => r.json())
        .then((d) => setYamlValue(d.yaml || `Error: ${d.error}`))
        .catch(() => setYamlValue('Error decoding YAML'));
    }
  }, [viewMode, valueBase64]);

  const handleSelect = async (key: string) => {
    setSelectedKey(key);
    setViewMode('yaml');
    setValue('Loading...');
    setValueBase64('');
    setYamlValue('');
    try {
      const res = await fetch(`/api/etcd/keys?key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (res.ok) {
        setValue(data.stringValue || '');
        setValueBase64(data.value || '');
      } else {
        setValue(`Error: ${data.error}`);
      }
    } catch {
      setValue('Error loading value');
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(null), 220);
    }, 3000);
  };

  const handleSave = async () => {
    if (!selectedKey) return;
    setSaving(true);
    try {
      const res = await fetch('/api/etcd/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selectedKey, value }),
      });
      if (res.ok) {
        showToast('Saved successfully', 'success');
      } else {
        const err = await res.json();
        showToast(`Failed to save: ${err.error}`, 'error');
      }
    } catch {
      showToast('Error saving', 'error');
    }
    setSaving(false);
  };

  const handleDeleteClick = () => {
    if (selectedKey) setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedKey) return;
    setDeleteDialogOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/etcd/keys?key=${encodeURIComponent(selectedKey)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Deleted successfully', 'success');
        setSelectedKey(null);
        setValue('');
        fetchKeys();
      } else {
        const err = await res.json();
        showToast(`Failed to delete: ${err.error}`, 'error');
      }
    } catch {
      showToast('Error deleting', 'error');
    }
    setDeleting(false);
  };

  return (
    <div
      className="flex flex-col h-dvh w-screen text-gray-200"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      {/* Top bar */}
      <header className="h-9 min-h-9 flex items-center px-3 gap-4 border-b border-white/10" style={{ backgroundColor: '#252526' }}>
        <span className="font-semibold text-gray-200 shrink-0 tracking-tight">fireETCD</span>
        <div className="ml-auto flex items-center gap-2 py-1 px-3 border border-white/10 rounded text-sm max-w-[280px] flex-1" style={{ backgroundColor: '#2d2d30' }}>
          <MagnifyingGlassIcon className="w-4 h-4 shrink-0 text-gray-400 opacity-70" strokeWidth={1.5} />
          <input
            type="text"
            value={keySearch}
            onChange={(e) => setKeySearch(e.target.value)}
            placeholder="Search etcd keys..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-200 placeholder:text-gray-500 text-sm"
            aria-label="Search keys"
          />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Activity bar */}
        <aside className="w-12 min-w-12 flex flex-col items-center pt-2 border-r border-white/10" style={{ backgroundColor: '#252526' }}>
          <button
            type="button"
            className="w-12 h-12 flex items-center justify-center text-gray-200 bg-white/5 border-l-2 border-l-violet-500"
            title="Explorer"
            aria-label="Explorer"
          >
            <Squares2X2Icon className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </aside>

        {/* Sidebar - Headless UI Listbox */}
        <div className="w-72 min-w-[220px] flex flex-col min-h-0 border-r border-white/10" style={{ backgroundColor: '#2d2d30' }}>
          <div className="pt-3 px-2 border-b border-white/10">
            <Listbox value={explorerOptions[0]} onChange={() => {}}>
              <div className="relative">
                <Listbox.Button
                  className="w-full py-1.5 px-2 mb-2 border border-white/10 rounded text-gray-200 text-sm cursor-pointer text-left flex items-center justify-between"
                  style={{ backgroundColor: '#252526' }}
                >
                  <span>etcd Explorer</span>
                  <ChevronRightIcon className="w-4 h-4 rotate-90 opacity-70" strokeWidth={1.5} />
                </Listbox.Button>
                <Listbox.Options className="absolute left-0 right-0 top-full mt-0.5 rounded border border-white/10 overflow-hidden z-50" style={{ backgroundColor: '#252526' }}>
                  <Listbox.Option
                    value={explorerOptions[0]}
                    className={({ active }) =>
                      `py-2 px-3 text-sm cursor-default ${active ? 'bg-white/10 text-gray-200' : 'text-gray-400'}`
                    }
                  >
                    {explorerOptions[0].label}
                  </Listbox.Option>
                </Listbox.Options>
              </div>
            </Listbox>
            <div className="flex">
              <span className="py-2 px-4 text-xs text-gray-200 border-b-2 border-violet-500">Keys</span>
            </div>
          </div>
          <div className="flex-grow overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-gray-400">
                <ArrowPathIcon className="w-6 h-6 animate-spin" strokeWidth={1.5} />
                <span>Fetching keys...</span>
              </div>
            ) : keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <span>No keys found.</span>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-center px-2">
                <span>No keys match &quot;{keySearch.trim()}&quot;</span>
              </div>
            ) : (
              <TreeItem node={tree} onSelect={handleSelect} selectedKey={selectedKey} forceExpanded={keySearch.trim() !== ''} />
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: '#1e1e1e' }}>
          {selectedKey ? (
            <>
              <div className="py-4 px-6 border-b border-white/10 flex justify-between items-start shrink-0">
                <div className="flex-grow mr-6">
                  <div className="text-xl font-semibold text-gray-200 break-all mb-2">{selectedKey}</div>
                  <div className="text-sm text-gray-400 font-mono py-1 px-2 rounded inline-block" style={{ backgroundColor: '#252526' }}>
                    Length: {value.length} bytes
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="py-2 px-4 rounded-md text-sm font-medium text-gray-200 border border-white/10 hover:bg-white/5 hover:border-white/20 inline-flex items-center gap-2"
                    style={{ backgroundColor: '#252526' }}
                    onClick={() => handleSelect(selectedKey)}
                  >
                    <ArrowPathIcon className="w-4 h-4" strokeWidth={1.5} />
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="py-2 px-4 rounded-md text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 inline-flex items-center gap-2"
                    onClick={handleDeleteClick}
                    disabled={deleting}
                  >
                    <TrashIcon className="w-4 h-4" strokeWidth={1.5} />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                  {/* <button
                    type="button"
                    className="py-2 px-4 rounded-md text-sm font-semibold bg-violet-600 text-white text-gray-900 hover:shadow-lg hover:shadow-violet-500/30 inline-flex items-center gap-2 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button> */}
                </div>
              </div>
              <div className="flex-1 min-h-0 relative">
                <div className="absolute inset-4 rounded-xl border border-white/10 overflow-hidden shadow-xl focus-within:border-violet-500 focus-within:shadow-violet-500/10 flex flex-col" style={{ backgroundColor: '#252526' }}>
                  <Tab.Group selectedIndex={viewMode === 'yaml' ? 0 : 1} onChange={(i) => setViewMode(i === 0 ? 'yaml' : 'raw')} className="flex flex-col flex-1 min-h-0">
                    <Tab.List className="flex shrink-0 bg-black/20 border-b border-white/10">
                      <Tab
                        className={({ selected }) =>
                          `px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors outline-none ${
                            selected ? 'text-violet-400 border-b-violet-500' : 'text-gray-400 border-b-transparent hover:text-gray-200 hover:bg-white/5'
                          }`
                        }
                      >
                        YAML View
                        <span className="text-[10px] bg-violet-600 text-white text-gray-900 py-0.5 px-1.5 rounded font-bold uppercase tracking-wide">
                          beta
                        </span>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          `px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors outline-none ${
                            selected ? 'text-violet-400 border-b-violet-500' : 'text-gray-400 border-b-transparent hover:text-gray-200 hover:bg-white/5'
                          }`
                        }
                      >
                        Raw Value (Proto/String)
                      </Tab>
                    </Tab.List>
                    <Tab.Panels className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <Tab.Panel className="relative flex-1 min-h-0 overflow-hidden ">
                        <div ref={editorWrapRef} className="absolute inset-0 w-full m-3">
                          {editorHeight > 0 && (
                            <Editor
                              height={editorHeight}
                              width="100%"
                              theme="vs-dark"
                              language="yaml"
                              value={yamlValue}
                              options={{
                                readOnly: true,
                                wordWrap: 'on',
                                minimap: { enabled: false },
                                fontSize: 14,
                                scrollBeyondLastLine: false,
                              }}
                            />
                          )}
                        </div>
                      </Tab.Panel>
                      <Tab.Panel className="h-full overflow-hidden">
                        <textarea
                          className="h-full w-full bg-transparent border-none p-4 text-gray-200 font-mono text-sm leading-relaxed resize-none outline-none"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          spellCheck={false}
                        />
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
              <CubeIcon className="w-16 h-16 mb-6 text-violet-500 opacity-80" strokeWidth={1} />
              <div className="text-2xl font-semibold mb-3 text-gray-200">Select a Key</div>
              <div className="text-base max-w-md leading-relaxed">
                Browse the etcd tree on the left and select a key to view or edit its value.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation - Headless UI Dialog */}
      <Transition appear show={deleteDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[1100]" onClose={() => setDeleteDialogOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md rounded-xl border border-white/10 p-6 shadow-2xl" style={{ backgroundColor: '#252526' }}>
                  <Dialog.Title className="text-lg font-semibold text-gray-200 mb-2">Delete key?</Dialog.Title>
                  <p className="text-sm text-gray-400 mb-4">
                    Are you sure you want to delete <code className="font-mono text-gray-300 break-all">{selectedKey}</code>? This cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      className="py-2 px-4 rounded-md text-sm font-medium text-gray-200 border border-white/10 hover:bg-white/5"
                      style={{ backgroundColor: '#2d2d30' }}
                      onClick={() => setDeleteDialogOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="py-2 px-4 rounded-md text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 inline-flex items-center gap-2"
                      onClick={handleDeleteConfirm}
                    >
                      <TrashIcon className="w-4 h-4" strokeWidth={1.5} />
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={toastVisible} as={Fragment}>
        <div className="fixed bottom-6 right-6 z-[1000]">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="translate-y-6 opacity-0"
            enterTo="translate-y-0 opacity-100"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-6 opacity-0"
          >
            {toast && (
              <div
                style={{ backgroundColor: '#252526' }}
                className={`flex items-center gap-3 px-6 py-4 rounded-lg border shadow-xl ${
                  toast.type === 'success' ? 'border-green-500' : 'border-red-500'
                }`}
              >
                {toast.type === 'success' ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" strokeWidth={1.5} />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" strokeWidth={1.5} />
                )}
                <span className="text-gray-200">{toast.msg}</span>
              </div>
            )}
          </Transition.Child>
        </div>
      </Transition>
    </div>
  );
}
