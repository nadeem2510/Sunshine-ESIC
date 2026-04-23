/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Printer, 
  Search, 
  Filter, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MoreVertical,
  FileText,
  User,
  Calendar,
  Phone,
  Hospital,
  Settings,
  Users,
  Download,
  ShieldCheck,
  ChevronLeft,
  Trash2,
  X
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from './services/firebase';
import { patientService } from './services/patientService';
import { staffService } from './services/staffService';
import { PatientRecord, ApprovalStatus, FileStatus, Dispensary, Staff, StaffRole } from './types';
import { pdfService } from './services/pdfService';
import { cn } from './lib/utils';

type AppView = 'dashboard' | 'admin';

export default function App() {
  const [patients, setPatients] = React.useState<PatientRecord[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'extensionDate' | 'approvalStatus'>('extensionDate');
  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  // Auth Subscription
  React.useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Data Subscription
  React.useEffect(() => {
    if (!user) return;
    const unsubPatients = patientService.subscribeToPatients((data) => {
      setPatients(data);
    });
    
    const unsubStaff = staffService.subscribeToStaff((data) => {
      setStaff(data);
    });

    return () => {
      unsubPatients();
      unsubStaff();
    };
  }, [user]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    // Hardcoded bootstrapping
    if (user.email === 'nadeem2510@gmail.com') return true;
    return staff.some(s => s.email === user.email && s.role === 'admin');
  }, [user, staff]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.mobileNo.includes(searchTerm))
      .sort((a, b) => {
        if (sortBy === 'extensionDate') {
          return new Date(a.extensionDate).getTime() - new Date(b.extensionDate).getTime();
        }
        return a.approvalStatus.localeCompare(b.approvalStatus);
      });
  }, [patients, searchTerm, sortBy]);

  const stats = useMemo(() => ({
    active: patients.length,
    pending: patients.filter(p => p.approvalStatus === 'Pending').length,
    extensionToday: patients.filter(p => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const ext = format(new Date(p.extensionDate), 'yyyy-MM-dd');
      return ext === today;
    }).length,
    total: patients.length,
  }), [patients]);

  const handlePrintDaily = () => {
    pdfService.generateDashboardReport(filteredPatients);
  };

  const handlePrintPatient = (p: PatientRecord) => {
    pdfService.generatePatientReport(p);
  };

  const handleSavePatient = async (data: Omit<PatientRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    await patientService.addPatient(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hospital-bg flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="bg-hospital-primary p-4 rounded-xl text-white"
        >
          <Hospital size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-hospital-bg flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-[24px] shadow-sm w-full max-w-md text-center border border-hospital-border">
          <div className="bg-hospital-primary w-16 h-16 rounded-xl flex items-center justify-center text-white mx-auto mb-6">
            <Hospital size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Sunshine Hospital</h1>
          <p className="text-slate-500 font-medium mb-8">Internal ESIC Records Dashboard</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" />
            Sign in with Google
          </button>
          <p className="text-xs text-slate-400 mt-8 leading-relaxed italic">
            This application is for internal use only.<br />Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hospital-bg font-sans text-hospital-text flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-hospital-border h-[70px] px-6 flex items-center justify-between flex-shrink-0 z-10 transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-hospital-primary w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
            SH
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-950 leading-none">Sunshine Hospital</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">ESIC Patient Management System</p>
          </div>
        </div>

        <div className="text-sm font-medium text-slate-500 hidden md:block">
          {format(new Date(), 'EEEE, MMM dd, yyyy')}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Quick search..."
              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-hospital-border rounded-lg w-48 lg:w-64 text-sm focus:ring-2 focus:ring-hospital-primary/10 outline-none transition-all placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {isAdmin && (
              <button 
                onClick={() => setCurrentView(currentView === 'dashboard' ? 'admin' : 'dashboard')}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border rounded-md text-xs font-semibold transition-all",
                  currentView === 'admin' 
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                    : "border-hospital-border text-slate-600 hover:bg-slate-50"
                )}
              >
                <Settings size={14} />
                {currentView === 'admin' ? 'Exit Admin' : 'Admin Panel'}
              </button>
            )}

            <button 
              onClick={handlePrintDaily}
              className="flex items-center gap-2 px-3 py-2 border border-hospital-border text-slate-600 rounded-md text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <Printer size={14} />
              Print Daily
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-hospital-primary text-white rounded-md text-xs font-semibold hover:bg-hospital-accent transition-all active:scale-95 shadow-sm shadow-sky-100"
            >
              <Plus size={14} />
              Add Patient
            </button>
          </div>

          <div className="h-6 w-[1px] bg-hospital-border mx-1" />

          <div className="flex items-center gap-3">
            <div className="text-right hidden xl:block">
              <div className="text-[11px] font-bold text-slate-900 leading-none">{user.displayName}</div>
              <button 
                onClick={handleLogout}
                className="text-[9px] font-bold text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-widest mt-0.5 leading-none"
              >
                Sign Out
              </button>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-lg border border-hospital-border object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-[10px] font-bold border border-hospital-border">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {currentView === 'dashboard' ? (
          <motion.main 
            key="dashboard"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex-1 p-6 overflow-auto flex flex-col gap-6"
          >
            <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-6 h-full">
              
              {/* Stats Row */}
              <section className="grid grid-cols-4 gap-6 flex-shrink-0">
                <div className="bg-white p-5 rounded-xl border border-hospital-border shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Active Admissions</div>
                  <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-hospital-border shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Pending Approvals</div>
                  <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-hospital-border shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Extensions Today</div>
                  <div className="text-2xl font-bold text-rose-600">{stats.extensionToday}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-hospital-border shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Total ESIC Files</div>
                  <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                </div>
              </section>

              {/* Table Container */}
              <div className="bg-white rounded-xl border border-hospital-border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 text-xs">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="sticky top-0 z-10">
                        <th className="w-[20%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Patient Name</th>
                        <th className="w-[12%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Mobile</th>
                        <th className="w-[15%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Dispensary</th>
                        <th className="w-[10%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">DOA</th>
                        <th className="w-[12%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Approval</th>
                        <th className="w-[8%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border text-center">Days</th>
                        <th className="w-[13%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Exp. Ext Date</th>
                        <th className="w-[10%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <AnimatePresence mode="popLayout">
                        {filteredPatients.map((patient) => (
                          <motion.tr 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key={patient.id}
                            className={cn(
                              "group transition-colors",
                              patient.reApprovalNeeded ? "bg-rose-50/50" : "hover:bg-slate-50/30"
                            )}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {patient.reApprovalNeeded && <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />}
                                <span className="font-bold text-slate-900 truncate tracking-tight">{patient.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[13px] text-slate-600 font-medium tabular-nums">
                              {patient.mobileNo}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded tracking-tight">
                                {patient.dispensary}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[13px] text-slate-500 whitespace-nowrap">
                              {format(new Date(patient.dateOfAdmission), 'dd MMM yy')}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={patient.approvalStatus} />
                            </td>
                            <td className="px-4 py-3 text-[13px] text-slate-600 font-bold text-center">
                              {patient.daysApproved}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className={cn(
                                "text-[13px] font-bold",
                                patient.reApprovalNeeded ? "text-rose-700" : "text-slate-800"
                              )}>
                                {format(new Date(patient.extensionDate), 'dd MMM yy')}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handlePrintPatient(patient)}
                                  className="p-1 px-2 border border-slate-100 text-slate-300 hover:text-hospital-primary hover:border-hospital-primary transition-all rounded bg-white shadow-sm"
                                  title="Print Report"
                                >
                                  <FileText size={14} />
                                </button>
                                <button className="p-1 px-2 border border-slate-100 text-slate-300 hover:text-slate-600 hover:border-slate-300 transition-all rounded bg-white shadow-sm">
                                  <MoreVertical size={14} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                {filteredPatients.length === 0 && (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                    <Hospital size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-bold tracking-widest uppercase">No Records Found</p>
                  </div>
                )}
              </div>
            </div>
          </motion.main>
        ) : (
          <motion.main
            key="admin"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 p-6 overflow-auto"
          >
            <AdminPanel staff={staff} patients={patients} />
          </motion.main>
        )}
      </AnimatePresence>

      {/* Modal Placeholder */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
                <h3 className="text-xl font-bold text-slate-900">New Patient Admission</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <PatientForm 
                onSave={handleSavePatient}
                onSuccess={() => setIsModalOpen(false)} 
                onCancel={() => setIsModalOpen(false)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Re-Approval Banner */}
      {patients.some(p => p.reApprovalNeeded) && (
        <div className="bg-rose-600 text-white px-8 py-2 text-center text-sm font-bold animate-pulse">
           ATTENTION: Some patients require immediate re-approval based on their extension dates!
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ApprovalStatus }) {
  const configs = {
    'Approved': 'bg-emerald-100 text-emerald-700',
    'Pending': 'bg-amber-100 text-amber-700',
    'Rejected': 'bg-rose-100 text-rose-700',
  };

  return (
    <span className={cn(
      "status-pill px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
      configs[status]
    )}>
      {status}
    </span>
  );
}

function PatientForm({ onSuccess, onCancel, onSave }: { onSuccess: () => void, onCancel: () => void, onSave: (data: Omit<PatientRecord, 'id' | 'createdAt' | 'updatedAt'>) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    mobileNo: '',
    dispensary: 'Waluj' as Dispensary,
    dateOfAdmission: format(new Date(), 'yyyy-MM-dd'),
    approvalStatus: 'Pending' as ApprovalStatus,
    daysApproved: 0,
    extensionDate: format(new Date(), 'yyyy-MM-dd'),
    reApprovalNeeded: false,
    fileStatus: 'Initial Stage' as FileStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate extension date when DOA or days change
  React.useEffect(() => {
    if (formData.dateOfAdmission && formData.daysApproved >= 0) {
      const doa = new Date(formData.dateOfAdmission);
      const ext = addDays(doa, formData.daysApproved);
      setFormData(prev => ({ ...prev, extensionDate: format(ext, 'yyyy-MM-dd') }));
    }
  }, [formData.dateOfAdmission, formData.daysApproved]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Required';
    if (!/^[0-9]{10}$/.test(formData.mobileNo)) newErrors.mobileNo = '10 digits required';
    if (formData.daysApproved < 0) newErrors.daysApproved = 'Must be >= 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...formData,
        dateOfAdmission: new Date(formData.dateOfAdmission).toISOString(),
        extensionDate: new Date(formData.extensionDate).toISOString(),
      });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-auto">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Name</label>
          <input 
            type="text" 
            required
            className={cn(
              "w-full px-4 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none transition-all placeholder:text-slate-300 text-sm font-medium",
              errors.name ? "border-rose-200" : "border-hospital-border"
            )}
            placeholder="Full Name"
            value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mobile No</label>
          <input 
            type="tel" 
            maxLength={10} 
            required
            className={cn(
              "w-full px-4 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none transition-all placeholder:text-slate-300 text-sm font-medium",
              errors.mobileNo ? "border-rose-200" : "border-hospital-border"
            )}
            placeholder="98xxxx"
            value={formData.mobileNo}
            onChange={e => setFormData(p => ({ ...p, mobileNo: e.target.value.replace(/\D/g, '') }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ESIC Dispensary</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.dispensary}
            onChange={e => setFormData(p => ({ ...p, dispensary: e.target.value as Dispensary }))}
          >
            <option value="Waluj">Waluj</option>
            <option value="Paithan">Paithan</option>
            <option value="Chikalthana">Chikalthana</option>
            <option value="CIDCO">CIDCO</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">File Status</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.fileStatus}
            onChange={e => setFormData(p => ({ ...p, fileStatus: e.target.value as FileStatus }))}
          >
            <option value="Initial Stage">Initial Stage</option>
            <option value="Documentation Pending">Documentation Pending</option>
            <option value="File Completed">File Completed</option>
            <option value="Final Submission to ESIC">Final Submission to ESIC</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Admission Date (DOA)</label>
          <input 
            type="date" 
            required
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.dateOfAdmission}
            onChange={e => setFormData(p => ({ ...p, dateOfAdmission: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Days Approved</label>
          <input 
            type="number" 
            min="0"
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.daysApproved}
            onChange={e => setFormData(p => ({ ...p, daysApproved: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expected Extension</label>
          <input 
            type="date" 
            className="w-full px-4 py-2 bg-slate-100 border border-hospital-border rounded-lg outline-none text-sm font-bold text-hospital-primary"
            value={formData.extensionDate}
            onChange={e => setFormData(p => ({ ...p, extensionDate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Approval Status</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.approvalStatus}
            onChange={e => setFormData(p => ({ ...p, approvalStatus: e.target.value as ApprovalStatus }))}
          >
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-hospital-border">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm",
            formData.reApprovalNeeded ? "bg-rose-500 text-white" : "bg-white text-slate-300 border border-hospital-border"
          )}>
            <AlertCircle size={16} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Re-Approval Required</div>
            <div className="text-[10px] text-slate-400 font-medium">High priority follow-up needed</div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={formData.reApprovalNeeded}
            onChange={e => setFormData(p => ({ ...p, reApprovalNeeded: e.target.checked }))}
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
        </label>
      </div>
      
      <div className="flex items-center gap-3 pt-4 sticky bottom-0 bg-white shadow-[0_-10px_20px_rgba(255,255,255,0.8)]">
        <button type="button" onClick={onCancel} className="flex-1 py-3 px-6 border border-hospital-border text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
        <button type="submit" className="flex-[2] py-3 px-6 bg-hospital-primary text-white text-xs font-bold rounded-lg shadow-sm shadow-sky-100 hover:bg-hospital-accent active:scale-[0.98] transition-all">Save Admission Record</button>
      </div>
    </form>
  );
}

function AdminPanel({ staff, patients }: { staff: Staff[], patients: PatientRecord[] }) {
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hospital Administration</h2>
          <p className="text-sm text-slate-500 font-medium">Manage team access and system-wide reports</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => pdfService.generateDashboardReport(patients)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-hospital-border text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={16} />
            Master Report (PDF)
          </button>
          <button 
            onClick={() => setIsAddingStaff(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-sm shadow-slate-200"
          >
            <Users size={16} />
            Add Team Member
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-hospital-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-hospital-border bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <ShieldCheck size={16} className="text-hospital-primary" />
                Authorized Team Members
              </h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hospital-border">
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Name</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Email</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">Role</th>
                  <th className="px-6 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staff.map((member) => (
                  <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{member.displayName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{member.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        member.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => staffService.deleteStaff(member.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-hospital-border shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              Report Downloads
            </h3>
            <div className="space-y-2">
              <button 
                onClick={() => pdfService.generateDashboardReport(patients)}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-hospital-primary transition-colors">Full Daily Grid</div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">Export all active ESIC patient status</div>
              </button>
              <button 
                onClick={() => {
                  const pending = patients.filter(p => p.approvalStatus === 'Pending');
                  pdfService.generateDashboardReport(pending);
                }}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">Pending Only</div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">Export only records awaiting ESIC approval</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingStaff && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingStaff(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Add Team Member</h3>
                <button onClick={() => setIsAddingStaff(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <StaffForm 
                onCancel={() => setIsAddingStaff(false)} 
                onSuccess={() => setIsAddingStaff(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StaffForm({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
  const [data, setData] = useState({
    displayName: '',
    email: '',
    role: 'staff' as StaffRole
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await staffService.addStaff(data);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
        <input 
          type="text" 
          required
          className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg text-sm"
          value={data.displayName}
          onChange={e => setData(p => ({ ...p, displayName: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</label>
        <input 
          type="email" 
          required
          className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg text-sm"
          value={data.email}
          onChange={e => setData(p => ({ ...p, email: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Role</label>
        <select 
          className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg text-sm"
          value={data.role}
          onChange={e => setData(p => ({ ...p, role: e.target.value as StaffRole }))}
        >
          <option value="staff">Staff (Standard access)</option>
          <option value="admin">Administrator (System configuration)</option>
        </select>
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-hospital-border text-xs font-bold rounded-lg leading-none">Cancel</button>
        <button type="submit" className="flex-[2] py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm leading-none">Add Member</button>
      </div>
    </form>
  );
}
