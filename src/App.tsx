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
  FileSpreadsheet,
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
  X,
  CalendarDays,
  History,
  FileBadge,
  LogOut
} from 'lucide-react';
import { format, addDays, differenceInDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from './services/firebase';
import { patientService } from './services/patientService';
import { staffService } from './services/staffService';
import { PatientRecord, ApprovalStatus, FileStatus, Dispensary, Staff, StaffRole, PatientExtension } from './types';
import { pdfService } from './services/pdfService';
import { excelService } from './services/excelService';
import { cn } from './lib/utils';

type AppView = 'dashboard' | 'admin' | 'extended';

export default function App() {
  const [patients, setPatients] = React.useState<PatientRecord[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'extensionDate' | 'approvalStatus'>('extensionDate');
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  
  // Advanced Filters
  const [filterDispensary, setFilterDispensary] = useState<Dispensary | 'All'>('All');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Local Action States
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isStatusActionSheetOpen, setIsStatusActionSheetOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

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
      .filter(p => {
        // Search Filter
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.mobileNo.includes(searchTerm);
        
        // Dispensary Filter
        const matchesDispensary = filterDispensary === 'All' || p.dispensary === filterDispensary;
        
        // Date Range Filter
        let matchesDate = true;
        if (filterStartDate || filterEndDate) {
          const doa = new Date(p.dateOfAdmission);
          const start = filterStartDate ? startOfDay(new Date(filterStartDate)) : new Date(0);
          const end = filterEndDate ? endOfDay(new Date(filterEndDate)) : new Date(8640000000000000);
          matchesDate = isWithinInterval(doa, { start, end });
        }

        // View Filter (Dashboard vs Extended)
        const isNotDischarged = p.approvalStatus !== 'Discharged';
        const matchesView = currentView === 'extended' 
          ? (isNotDischarged && p.extensions && p.extensions.length > 0) 
          : (currentView === 'dashboard' ? isNotDischarged : true);

        return matchesSearch && matchesDispensary && matchesDate && matchesView;
      })
      .sort((a, b) => {
        if (sortBy === 'extensionDate') {
          return new Date(a.extensionDate).getTime() - new Date(b.extensionDate).getTime();
        }
        return a.approvalStatus.localeCompare(b.approvalStatus);
      });
  }, [patients, searchTerm, sortBy, filterDispensary, filterStartDate, filterEndDate, currentView]);

  const stats = useMemo(() => {
    const activePatients = patients.filter(p => p.approvalStatus !== 'Discharged');
    return {
      active: activePatients.length,
      pending: patients.filter(p => p.approvalStatus === 'Pending').length,
      extensionToday: activePatients.filter(p => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const ext = format(new Date(p.extensionDate), 'yyyy-MM-dd');
        return ext === today;
      }).length,
      total: patients.length,
      discharged: patients.filter(p => p.approvalStatus === 'Discharged').length
    };
  }, [patients]);

  const handlePrintDaily = () => {
    pdfService.generateDashboardReport(filteredPatients);
  };

  const handleExportExcel = () => {
    excelService.exportPatientsToExcel(filteredPatients, `Sunshine_Hospital_Records_${currentView}`);
  };

  const handlePrintPatient = (p: PatientRecord) => {
    pdfService.generatePatientReport(p);
  };

  const handleSavePatient = async (data: Omit<PatientRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    await patientService.addPatient(data);
  };

  const handleUpdateStatus = async (status: ApprovalStatus) => {
    if (selectedPatient) {
      await patientService.updatePatient(selectedPatient.id, { approvalStatus: status, reApprovalNeeded: status === 'Approved' ? false : selectedPatient.reApprovalNeeded });
      setIsStatusActionSheetOpen(false);
      setSelectedPatient(null);
    }
  };

  const handleCaseResolution = async (type: 'extension' | 'discharge', data: any) => {
    if (selectedPatient) {
      if (type === 'extension') {
        await patientService.addExtension(selectedPatient.id, data.extension, data.newDate);
      } else {
        await patientService.dischargePatient(selectedPatient.id, data.reason);
      }
      setIsExtensionModalOpen(false);
      setSelectedPatient(null);
    }
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
      <header className="bg-white border-b border-hospital-border flex-shrink-0 z-20 shadow-sm">
        {/* Top Level: Logo & Nav & Profile */}
        <div className="h-[64px] px-6 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-hospital-primary w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                SH
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold tracking-tight text-slate-950 leading-none">Sunshine Hospital</h1>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">ESIC Management</p>
              </div>
            </div>

            <nav className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-100">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  currentView === 'dashboard' ? "bg-white text-hospital-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setCurrentView('extended')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  currentView === 'extended' ? "bg-white text-hospital-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <FileBadge size={14} />
                Extended Approvals
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setCurrentView('admin')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    currentView === 'admin' ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Settings size={14} />
                  Admin
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right mr-2">
              <div className="text-[11px] font-bold text-slate-900 leading-none">{user.displayName}</div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{isAdmin ? 'Administrator' : 'Staff Member'}</p>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-hospital-primary text-white rounded-lg text-xs font-bold hover:bg-hospital-accent transition-all active:scale-95 shadow-lg shadow-sky-100"
            >
              <Plus size={16} />
              New Patient
            </button>

            <div className="h-8 w-[1px] bg-slate-100 mx-2" />

            <div className="flex items-center gap-3">
              <button 
                onClick={handleLogout}
                className="group relative"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-xl border border-slate-200 object-cover group-hover:border-rose-200 transition-colors" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-bold border border-slate-200 group-hover:border-rose-200 transition-colors">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              </button>
            </div>
          </div>
        </div>

        {/* Lower Level: Filters (Visible everywhere except Admin unless needed) */}
        {currentView !== 'admin' && (
          <div className="h-[52px] px-6 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-hospital-primary/10 transition-all">
                <Search size={14} className="text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search name or phone..."
                  className="bg-transparent border-none w-48 text-xs font-medium focus:ring-0 outline-none placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="h-6 w-[1px] bg-slate-200" />

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <Hospital size={14} className="text-slate-400" />
                <select 
                  value={filterDispensary}
                  onChange={(e) => setFilterDispensary(e.target.value as any)}
                  className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  <option value="All">All Dispensaries</option>
                  <option value="Waluj">Waluj</option>
                  <option value="Waluj DCBO">Waluj DCBO</option>
                  <option value="Paithan">Paithan</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm ml-2">
                <CalendarDays size={14} className="text-slate-400" />
                <div className="flex items-center gap-2">
                  <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:ring-0 p-0 w-24"
                  />
                  <span className="text-slate-300 text-[10px] font-bold uppercase tracking-tighter">to</span>
                  <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:ring-0 p-0 w-24"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden lg:block mr-2">
                {format(new Date(), 'MMM dd, yyyy')}
              </div>
              <button 
                onClick={handlePrintDaily}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-white hover:border-slate-300 transition-all active:scale-95 shadow-sm bg-white/50"
              >
                <Printer size={14} />
                Print Reports
              </button>

              {isAdmin && (
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-sm shadow-emerald-100"
                >
                  <FileSpreadsheet size={14} />
                  Export Excel
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {currentView === 'admin' ? (
          <motion.main
            key="admin"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 p-6 overflow-auto"
          >
            <AdminPanel staff={staff} patients={patients} />
          </motion.main>
        ) : (
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
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                    {currentView === 'extended' ? 'Extended Cases' : 'Active Admissions'}
                  </div>
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
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Total Discharged</div>
                  <div className="text-2xl font-bold text-slate-500">{stats.discharged}</div>
                </div>
              </section>

              {/* Table Container */}
              <div className="bg-white rounded-xl border border-hospital-border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 text-xs">
                  <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="sticky top-0 z-10">
                    <th className="w-[15%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Patient Name</th>
                    <th className="w-[10%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Mobile</th>
                    <th className="w-[12%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Category</th>
                    <th className="w-[12%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Dispensary</th>
                    <th className="w-[10%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">DOA</th>
                    <th className="w-[12%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Status</th>
                    {currentView === 'extended' ? (
                      <th className="w-[15%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border text-center">History</th>
                    ) : (
                      <th className="w-[8%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border text-center">Days</th>
                    )}
                    <th className="w-[13%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border">Exp. Date</th>
                    <th className="w-[10%] font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-3 border-b border-hospital-border text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <AnimatePresence mode="popLayout">
                      {filteredPatients.map((patient) => {
                        const isDueToday = format(new Date(patient.extensionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        
                        return (
                          <motion.tr 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key={patient.id}
                            onClick={() => {
                              setSelectedPatient(patient);
                              setIsStatusActionSheetOpen(true);
                            }}
                            className={cn(
                              "group transition-colors cursor-pointer",
                              patient.reApprovalNeeded 
                                ? "bg-rose-50/50 hover:bg-rose-100/50 underline-offset-4 decoration-rose-200" 
                                : isDueToday 
                                  ? "bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-400" 
                                  : "hover:bg-slate-50/30"
                            )}
                          >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {patient.reApprovalNeeded && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />}
                            <span className="font-bold text-slate-900 truncate tracking-tight">{patient.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-600 font-medium tabular-nums">
                          {patient.mobileNo}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold text-hospital-primary px-2 py-0.5 bg-sky-50 rounded tracking-tight">
                            {patient.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded tracking-tight">
                            {patient.dispensary}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap tabular-nums">
                          {format(new Date(patient.dateOfAdmission), 'dd MMM yy')}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={patient.approvalStatus} />
                        </td>
                        {currentView === 'extended' ? (
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col gap-0.5 items-center">
                              <span className="text-[9px] font-bold text-slate-400">Total Ext: {patient.extensions?.length || 0}</span>
                              <div className="flex gap-0.5 max-w-[80px] overflow-hidden">
                                {patient.extensions?.map((_, i) => (
                                  <div key={i} className="w-1 h-3 rounded-full bg-hospital-primary opacity-40 shrink-0" />
                                ))}
                              </div>
                            </div>
                          </td>
                        ) : (
                          <td className="px-4 py-3 text-[12px] text-slate-600 font-bold text-center tabular-nums">
                            {patient.daysApproved}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          <div className={cn(
                            "text-[12px] font-bold",
                            patient.reApprovalNeeded ? "text-rose-700" : isDueToday ? "text-amber-700 animate-pulse" : "text-slate-800"
                          )}>
                            {format(new Date(patient.extensionDate), 'dd MMM yy')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 transition-opacity">
                            <button 
                              onClick={() => {
                                setSelectedPatient(patient);
                                setIsExtensionModalOpen(true);
                              }}
                              className="p-1 px-2 border border-slate-100 text-hospital-primary hover:bg-hospital-primary hover:text-white transition-all rounded bg-white shadow-sm font-bold text-[9px] uppercase tracking-tighter"
                              title="Update Case"
                            >
                              Update Status
                            </button>
                            <button 
                              onClick={() => handlePrintPatient(patient)}
                              className="p-1 px-2 border border-slate-100 text-slate-300 hover:text-hospital-primary hover:border-hospital-primary transition-all rounded bg-white shadow-sm"
                              title="Print Report"
                            >
                              <FileText size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
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

      {/* Action Dialogs */}
      <StatusActionSheet 
        isOpen={isStatusActionSheetOpen}
        onClose={() => setIsStatusActionSheetOpen(false)}
        patient={selectedPatient}
        onUpdate={handleUpdateStatus}
      />

      <CaseResolutionModal 
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        patient={selectedPatient}
        onSave={handleCaseResolution}
      />
    </div>
  );
}

function StatusPill({ status }: { status: ApprovalStatus }) {
  const configs = {
    'Approved': 'bg-emerald-100 text-emerald-700',
    'Pending': 'bg-amber-100 text-amber-700',
    'Rejected': 'bg-rose-100 text-rose-700',
    'Discharged': 'bg-slate-100 text-slate-700',
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
    category: 'Medical Management' as PatientCategory,
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
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Treatment Category</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.category}
            onChange={e => setFormData(p => ({ ...p, category: e.target.value as PatientCategory }))}
          >
            <option value="Surgical">Surgical</option>
            <option value="Medical Management">Medical Management</option>
            <option value="Maternity">Maternity</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ESIC Dispensary</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-hospital-border rounded-lg focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium"
            value={formData.dispensary}
            onChange={e => setFormData(p => ({ ...p, dispensary: e.target.value as Dispensary }))}
          >
            <option value="Waluj">Waluj</option>
            <option value="Waluj DCBO">Waluj DCBO</option>
            <option value="Paithan">Paithan</option>
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

function StatusActionSheet({ isOpen, onClose, patient, onUpdate }: { isOpen: boolean, onClose: () => void, patient: PatientRecord | null, onUpdate: (status: ApprovalStatus) => void }) {
  if (!patient) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-xl bg-white rounded-t-3xl shadow-2xl z-[70] p-6 pb-12"
          >
            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{patient.name}</h3>
                <p className="text-sm text-slate-400 font-medium">{patient.dispensary} • Registered {format(new Date(patient.createdAt), 'dd MMM')}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => onUpdate('Approved')}
                className="flex items-center gap-4 w-full p-5 rounded-2xl border border-emerald-100 hover:bg-emerald-50 transition-all text-left bg-white group"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div className="font-bold text-emerald-900 leading-none mb-1">Approve Patient</div>
                  <div className="text-xs text-emerald-600/70 font-medium">Validation completed and file sent for processing</div>
                </div>
              </button>

              <button 
                onClick={() => onUpdate('Rejected')}
                className="flex items-center gap-4 w-full p-5 rounded-2xl border border-rose-100 hover:bg-rose-50 transition-all text-left bg-white group"
              >
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <div className="font-bold text-rose-900 leading-none mb-1">Reject Application</div>
                  <div className="text-xs text-rose-600/70 font-medium">Incomplete documents or ESIC mismatch</div>
                </div>
              </button>

              <button 
                onClick={() => onUpdate('Pending')}
                className="flex items-center gap-4 w-full p-5 rounded-2xl border border-amber-100 hover:bg-amber-50 transition-all text-left bg-white group"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="font-bold text-amber-900 leading-none mb-1">Set to Pending</div>
                  <div className="text-xs text-amber-600/70 font-medium">Waiting for ESIC approval or further scrutiny</div>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CaseResolutionModal({ isOpen, onClose, patient, onSave }: { isOpen: boolean, onClose: () => void, patient: PatientRecord | null, onSave: (type: 'extension' | 'discharge', data: any) => void }) {
  const [activeTab, setActiveTab] = useState<'extension' | 'discharge'>('extension');
  const [formData, setFormData] = useState({
    additionalDays: 1,
    reason: ''
  });

  if (!patient) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'extension') {
      const currentExtDate = new Date(patient.extensionDate);
      const newExtDate = addDays(currentExtDate, formData.additionalDays);
      onSave('extension', {
        extension: { additionalDays: formData.additionalDays, reason: formData.reason },
        newDate: newExtDate.toISOString()
      });
    } else {
      onSave('discharge', { reason: formData.reason });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[80] p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-hospital-border"
          >
            <div className="p-0 border-b border-hospital-border">
              <div className="flex">
                <button 
                  type="button"
                  onClick={() => setActiveTab('extension')}
                  className={cn(
                    "flex-1 py-6 flex flex-col items-center gap-2 transition-all border-b-2",
                    activeTab === 'extension' ? "bg-white border-hospital-primary" : "bg-slate-50 border-transparent text-slate-400"
                  )}
                >
                  <Plus size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Extension</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('discharge')}
                  className={cn(
                    "flex-1 py-6 flex flex-col items-center gap-2 transition-all border-b-2",
                    activeTab === 'discharge' ? "bg-white border-rose-500 text-rose-600" : "bg-slate-50 border-transparent text-slate-400"
                  )}
                >
                  <LogOut size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Discharge</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-slate-100 p-2 rounded-xl text-slate-500">
                  <Hospital size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{patient.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Case Status Update</p>
                </div>
              </div>

              {activeTab === 'extension' && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Additional Days</label>
                    <div className="flex items-center gap-4">
                      <button 
                        type="button" 
                        onClick={() => setFormData(p => ({ ...p, additionalDays: Math.max(1, p.additionalDays - 1) }))}
                        className="w-12 h-12 bg-slate-50 border border-hospital-border rounded-xl flex items-center justify-center text-slate-400 hover:text-hospital-primary hover:border-hospital-primary transition-all font-bold"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        className="flex-1 h-12 bg-slate-50 border border-hospital-border rounded-xl text-center text-lg font-bold text-slate-900 outline-none"
                        value={formData.additionalDays}
                        onChange={e => setFormData(p => ({ ...p, additionalDays: parseInt(e.target.value) || 0 }))}
                      />
                      <button 
                        type="button" 
                        onClick={() => setFormData(p => ({ ...p, additionalDays: p.additionalDays + 1 }))}
                        className="w-12 h-12 bg-slate-50 border border-hospital-border rounded-xl flex items-center justify-center text-slate-400 hover:text-hospital-primary hover:border-hospital-primary transition-all font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {activeTab === 'extension' ? 'Reason for extension' : 'Discharge Remarks'}
                </label>
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-hospital-border rounded-xl focus:ring-2 focus:ring-hospital-primary/20 outline-none text-sm font-medium transition-all"
                  placeholder={activeTab === 'extension' ? "Medical grounds, ICU monitoring, etc..." : "Patient recovered, treatment completed, etc..."}
                  value={formData.reason}
                  onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-slate-600"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className={cn(
                    "flex-[2] py-4 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95",
                    activeTab === 'extension' ? "bg-hospital-primary shadow-sky-100 hover:bg-hospital-accent" : "bg-rose-500 shadow-rose-100 hover:bg-rose-600"
                  )}
                >
                  {activeTab === 'extension' ? 'Submit Extension' : 'Confirm Discharge'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
