import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calculator, Receipt, FileText, Download, Plus, Trash2, Edit2,
  TrendingDown, TrendingUp, CheckCircle, FileSpreadsheet,
  File as FilePdf, X, BookOpen, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useAuthStore } from '@/stores';
import { taxService, expenseService, taxReportService } from '@/services';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES } from '@/types';
import type { TaxSettings, BusinessExpense, TaxReport, TaxCalculation, ExpenseCategorySummary } from '@/types';

const REPORT_FORMATS = [
  { value: 'pdf', label: 'PDF Document', icon: FilePdf },
  { value: 'csv', label: 'CSV Spreadsheet', icon: FileSpreadsheet },
  { value: 'excel', label: 'Excel Workbook', icon: FileSpreadsheet },
];

export default function TaxExpensesPage() {
  const { currentStore } = useStoreStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'reports'>('overview');
  const [showTaxGuide, setShowTaxGuide] = useState(false);
  
  // Tax Settings
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [taxForm, setTaxForm] = useState({
    tax_rate: '',
    tax_name: 'VAT',
    tax_id_number: '',
    country: 'Nigeria',
    state: '',
    is_tax_enabled: false,
  });

  // Expenses
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySummary[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_name: '',
    expense_category: EXPENSE_CATEGORIES[0] as typeof EXPENSE_CATEGORIES[number],
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    is_recurring: false,
    recurring_frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  });

  // Reports
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPeriod, setReportPeriod] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  // Tax Calculation
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation | null>(null);
  const [calculationPeriod, setCalculationPeriod] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (currentStore?.id) {
      loadTaxSettings();
      loadExpenses();
      loadReports();
      calculateTax();
    }
  }, [currentStore]);

  const loadTaxSettings = async () => {
    if (!currentStore?.id) return;
    const { data } = await taxService.getTaxSettings(currentStore.id);
    if (data) {
      setTaxSettings(data);
      setTaxForm({
        tax_rate: data.tax_rate?.toString() || '',
        tax_name: data.tax_name || 'VAT',
        tax_id_number: data.tax_id_number || '',
        country: data.country || 'Nigeria',
        state: data.state || '',
        is_tax_enabled: data.is_tax_enabled || false,
      });
    }
  };

  const saveTaxSettings = async () => {
    if (!currentStore?.id || !user?.id) return;
    
    const settingsData = {
      store_id: currentStore.id,
      owner_id: user.id,
      tax_rate: parseFloat(taxForm.tax_rate) || 0,
      tax_name: taxForm.tax_name,
      tax_id_number: taxForm.tax_id_number,
      country: taxForm.country,
      state: taxForm.state,
      is_tax_enabled: taxForm.is_tax_enabled,
    };

    let result;
    if (taxSettings) {
      result = await taxService.updateTaxSettings(currentStore.id, settingsData);
    } else {
      result = await taxService.createTaxSettings(settingsData);
    }

    if (result.error) {
      toast.error('Failed to save tax settings');
    } else {
      toast.success('Tax settings saved successfully');
      setTaxSettings(result.data);
    }
  };

  const loadExpenses = async () => {
    if (!currentStore?.id) return;
    const { data } = await expenseService.getExpenses(currentStore.id);
    if (data) {
      setExpenses(data as BusinessExpense[]);
    }
    
    const { data: categoriesData } = await expenseService.getExpenseCategoriesSummary(currentStore.id);
    if (categoriesData) {
      setExpenseCategories(categoriesData as ExpenseCategorySummary[]);
    }
  };

  const saveExpense = async () => {
    if (!currentStore?.id || !user?.id) return;

    const expenseData = {
      store_id: currentStore.id,
      owner_id: user.id,
      expense_name: expenseForm.expense_name,
      expense_category: expenseForm.expense_category,
      amount: parseFloat(expenseForm.amount) || 0,
      expense_date: expenseForm.expense_date,
      description: expenseForm.description,
      is_recurring: expenseForm.is_recurring,
      recurring_frequency: expenseForm.is_recurring ? expenseForm.recurring_frequency : undefined,
    };

    let result;
    if (editingExpense) {
      result = await expenseService.updateExpense(editingExpense.id, expenseData);
    } else {
      result = await expenseService.createExpense(expenseData);
    }

    if (result.error) {
      toast.error('Failed to save expense');
    } else {
      toast.success(editingExpense ? 'Expense updated' : 'Expense added');
      setShowExpenseForm(false);
      setEditingExpense(null);
      resetExpenseForm();
      loadExpenses();
      calculateTax();
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    const { error } = await expenseService.deleteExpense(expenseId);
    if (error) {
      toast.error('Failed to delete expense');
    } else {
      toast.success('Expense deleted');
      loadExpenses();
      calculateTax();
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      expense_name: '',
      expense_category: EXPENSE_CATEGORIES[0],
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      description: '',
      is_recurring: false,
      recurring_frequency: 'monthly',
    });
  };

  const loadReports = async () => {
    if (!currentStore?.id) return;
    const { data } = await taxReportService.getReports(currentStore.id);
    if (data) {
      setReports(data as TaxReport[]);
    }
  };

  const calculateTax = async () => {
    if (!currentStore?.id) return;
    const { data } = await taxService.calculateTax(
      currentStore.id,
      calculationPeriod.start,
      calculationPeriod.end
    );
    if (data) {
      setTaxCalculation(data as TaxCalculation);
    }
  };

  const generateReport = async () => {
    if (!currentStore?.id || !user?.id || !taxCalculation) return;
    
    setIsGenerating(true);
    
    const reportName = `Tax Report ${reportPeriod.start} to ${reportPeriod.end}`;
    
    const reportData = {
      store_id: currentStore.id,
      owner_id: user.id,
      report_name: reportName,
      report_period_start: reportPeriod.start,
      report_period_end: reportPeriod.end,
      total_revenue: taxCalculation.total_revenue,
      total_expenses: taxCalculation.total_expenses,
      taxable_income: taxCalculation.taxable_income,
      tax_rate: taxSettings?.tax_rate || 0,
      tax_amount: taxCalculation.tax_amount,
      deductions: taxCalculation.total_expenses,
      net_tax_payable: taxCalculation.tax_amount,
      report_data: taxCalculation,
      file_format: selectedFormat,
    };

    const { error } = await taxReportService.createReport(reportData);
    
    if (error) {
      toast.error('Failed to generate report');
    } else {
      toast.success('Tax report generated successfully');
      setShowReportModal(false);
      loadReports();
      
      // Simulate download
      const blob = new Blob([JSON.stringify(taxCalculation, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-report-${reportPeriod.start}-${reportPeriod.end}.${selectedFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    setIsGenerating(false);
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax & Expenses</h1>
          <p className="text-gray-500 mt-1">Manage taxes, track business expenses, and stay compliant</p>
        </div>
      </div>

      {/* Scrollable Tabs & Guide Button */}
      <div className="flex items-center gap-4 border-b pb-1 overflow-x-auto hide-scrollbar">
        <div className="flex gap-2 min-w-max">
          {[
            { id: 'overview', label: 'Overview', icon: Calculator },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'reports', label: 'Reports', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="ml-auto pl-4 min-w-max">
          <Button 
            onClick={() => setShowTaxGuide(true)}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full shadow-sm"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Nigerian Tax Guide
          </Button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Tax Settings Card */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tax Settings</h2>
                <p className="text-sm text-gray-500">Configure your tax rate and details</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={taxForm.tax_rate}
                  onChange={(e) => setTaxForm({ ...taxForm, tax_rate: e.target.value })}
                  className="input-custom"
                  placeholder="e.g., 7.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Name
                </label>
                <input
                  type="text"
                  value={taxForm.tax_name}
                  onChange={(e) => setTaxForm({ ...taxForm, tax_name: e.target.value })}
                  className="input-custom"
                  placeholder="e.g., VAT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Identification Number (TIN)
                </label>
                <input
                  type="text"
                  value={taxForm.tax_id_number}
                  onChange={(e) => setTaxForm({ ...taxForm, tax_id_number: e.target.value })}
                  className="input-custom"
                  placeholder="Your FIRS/JTB TIN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={taxForm.country}
                  onChange={(e) => setTaxForm({ ...taxForm, country: e.target.value })}
                  className="input-custom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State/Region
                </label>
                <input
                  type="text"
                  value={taxForm.state}
                  onChange={(e) => setTaxForm({ ...taxForm, state: e.target.value })}
                  className="input-custom"
                  placeholder="e.g., Lagos"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxForm.is_tax_enabled}
                    onChange={(e) => setTaxForm({ ...taxForm, is_tax_enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-gray-700">Enable Tax Calculation</span>
                </label>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={saveTaxSettings} className="bg-orange-500 hover:bg-orange-600 text-white">
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Tax Settings
              </Button>
            </div>
          </div>

          {/* Tax Calculation Card */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tax Liability Calculator</h2>
                  <p className="text-sm text-gray-500">View your estimated tax liability based on set rates</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={calculationPeriod.start}
                  onChange={(e) => {
                    setCalculationPeriod({ ...calculationPeriod, start: e.target.value });
                    setTimeout(calculateTax, 100);
                  }}
                  className="input-custom text-sm"
                />
                <span className="text-gray-400 self-center">to</span>
                <input
                  type="date"
                  value={calculationPeriod.end}
                  onChange={(e) => {
                    setCalculationPeriod({ ...calculationPeriod, end: e.target.value });
                    setTimeout(calculateTax, 100);
                  }}
                  className="input-custom text-sm"
                />
              </div>
            </div>

            {taxCalculation ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(taxCalculation.total_revenue)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-sm text-red-600 mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(taxCalculation.total_expenses)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-600 mb-1">Taxable Income</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(taxCalculation.taxable_income)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm text-orange-600 mb-1">Estimated {taxForm.tax_name || 'Tax'} ({taxSettings?.tax_rate || 0}%)</p>
                  <p className="text-2xl font-bold text-orange-700">{formatCurrency(taxCalculation.tax_amount)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Calculator className="w-12 h-12 mx-auto mb-2" />
                <p>No tax data available for the selected period</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Recorded Expenses</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Possible Deductions</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Generated Reports</p>
                  <p className="text-xl font-bold text-gray-900">{reports.length}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Add Expense Button */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Business Expenses</h2>
            <Button 
              onClick={() => {
                setEditingExpense(null);
                resetExpenseForm();
                setShowExpenseForm(true);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </div>

          {/* Expense Categories */}
          {expenseCategories.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Expenses by Category</h3>
              <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                {expenseCategories.map((cat) => (
                  <div key={cat.category} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 truncate">{cat.category}</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(cat.total_amount)}</p>
                    <p className="text-xs text-gray-400">{cat.expense_count} items</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses List */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {expenses.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No expenses yet</h3>
                <p className="text-gray-500 mb-4">Add business expenses to track tax deductions</p>
                <Button 
                  onClick={() => setShowExpenseForm(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Expense</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Category</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Date</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Amount</th>
                      <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{expense.expense_name}</p>
                          {expense.description && (
                            <p className="text-sm text-gray-500">{expense.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                            {expense.expense_category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(expense.expense_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingExpense(expense);
                                setExpenseForm({
                                  expense_name: expense.expense_name,
                                  expense_category: expense.expense_category as typeof EXPENSE_CATEGORIES[number],
                                  amount: expense.amount.toString(),
                                  expense_date: expense.expense_date,
                                  description: expense.description || '',
                                  is_recurring: expense.is_recurring,
                                  recurring_frequency: (expense.recurring_frequency || 'monthly') as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
                                });
                                setShowExpenseForm(true);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Generate Report Button */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Tax Reports</h2>
            <Button 
              onClick={() => setShowReportModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>

          {/* Reports List */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {reports.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No reports yet</h3>
                <p className="text-gray-500 mb-4">Generate your first tax report to share with authorities or accountants.</p>
                <Button 
                  onClick={() => setShowReportModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Report Name</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Period</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Revenue</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Tax Amount</th>
                      <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">Format</th>
                      <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{report.report_name}</p>
                          <p className="text-sm text-gray-500">
                            Created {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(report.report_period_start).toLocaleDateString()} - {new Date(report.report_period_end).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-green-600">
                          {formatCurrency(report.total_revenue)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-orange-600">
                          {formatCurrency(report.tax_amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-700 uppercase">
                            {report.file_format}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                // Simulate download
                                toast.success('Downloading report...');
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                const { error } = await taxReportService.deleteReport(report.id);
                                if (!error) {
                                  toast.success('Report deleted');
                                  loadReports();
                                }
                              }}
                              className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Expense Form Modal */}
      <AnimatePresence>
        {showExpenseForm && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowExpenseForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto hide-scrollbar">
                <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingExpense ? 'Edit Expense' : 'Add Expense'}
                  </h3>
                  <button
                    onClick={() => setShowExpenseForm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expense Name *
                    </label>
                    <input
                      type="text"
                      value={expenseForm.expense_name}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expense_name: e.target.value })}
                      className="input-custom"
                      placeholder="e.g., Office Rent, Meta Ads"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={expenseForm.expense_category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expense_category: e.target.value as typeof EXPENSE_CATEGORIES[number] })}
                      className="input-custom"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (₦) *
                      </label>
                      <input
                        type="number"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className="input-custom"
                        placeholder="0.00"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={expenseForm.expense_date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                        className="input-custom"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className="input-custom min-h-[80px]"
                      placeholder="Additional details..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_recurring"
                      checked={expenseForm.is_recurring}
                      onChange={(e) => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <label htmlFor="is_recurring" className="text-gray-700">
                      This is a recurring expense
                    </label>
                  </div>
                  {expenseForm.is_recurring && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recurring Frequency
                      </label>
                      <select
                        value={expenseForm.recurring_frequency}
                        onChange={(e) => setExpenseForm({ ...expenseForm, recurring_frequency: e.target.value as any })}
                        className="input-custom"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t flex gap-3 sticky bottom-0 bg-white">
                  <button
                    onClick={() => setShowExpenseForm(false)}
                    className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={saveExpense}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={!expenseForm.expense_name || !expenseForm.amount}
                  >
                    {editingExpense ? 'Update' : 'Add'} Expense
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Generate Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowReportModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                <div className="p-6 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Generate Tax Report</h3>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Report Period
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={reportPeriod.start}
                        onChange={(e) => setReportPeriod({ ...reportPeriod, start: e.target.value })}
                        className="input-custom"
                      />
                      <span className="self-center text-gray-400">to</span>
                      <input
                        type="date"
                        value={reportPeriod.end}
                        onChange={(e) => setReportPeriod({ ...reportPeriod, end: e.target.value })}
                        className="input-custom"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Export Format
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {REPORT_FORMATS.map((format) => (
                        <button
                          key={format.value}
                          onClick={() => setSelectedFormat(format.value as any)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            selectedFormat === format.value
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <format.icon className={`w-6 h-6 mx-auto mb-2 ${
                            selectedFormat === format.value ? 'text-orange-500' : 'text-gray-400'
                          }`} />
                          <p className={`text-sm font-medium ${
                            selectedFormat === format.value ? 'text-orange-700' : 'text-gray-600'
                          }`}>
                            {format.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {taxCalculation && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Report Preview</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Revenue:</span>
                          <span className="font-medium">{formatCurrency(taxCalculation.total_revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Expenses:</span>
                          <span className="font-medium">{formatCurrency(taxCalculation.total_expenses)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Taxable Income:</span>
                          <span className="font-medium">{formatCurrency(taxCalculation.taxable_income)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-700 font-medium">Estimated Tax Amount:</span>
                          <span className="font-bold text-orange-600">{formatCurrency(taxCalculation.tax_amount)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t flex gap-3">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={generateReport}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Generate & Download
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Nigerian Tax Education Modal */}
      <AnimatePresence>
        {showTaxGuide && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowTaxGuide(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-green-600 p-6 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 text-white">
                    <BookOpen className="w-6 h-6" />
                    <div>
                      <h3 className="text-xl font-bold">Nigerian E-Commerce Tax Guide</h3>
                      <p className="text-green-100 text-sm">Last Updated: March 2026</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTaxGuide(false)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto hide-scrollbar space-y-8 bg-gray-50">
                  {/* Intro */}
                  <div className="bg-white p-5 rounded-xl border shadow-sm">
                    <p className="text-gray-700 leading-relaxed">
                      Operating an e-commerce store in Nigeria requires compliance with both the <strong>Federal Inland Revenue Service (FIRS)</strong> and your <strong>State Internal Revenue Service</strong>. Your exact tax obligations depend heavily on how your business is legally registered with the Corporate Affairs Commission (CAC).
                    </p>
                  </div>

                  {/* LLC vs Business Name */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      1. Business Structure & Income Tax
                    </h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <h5 className="font-bold text-blue-900 mb-2">Registered as an LLC</h5>
                        <p className="text-sm text-gray-600 mb-3">
                          Limited Liability Companies (Ltd) pay <strong>Companies Income Tax (CIT)</strong> to the FIRS based on annual turnover:
                        </p>
                        <ul className="text-sm space-y-2 text-gray-700">
                          <li>• <strong>Small</strong> (Under ₦25m): <span className="font-bold text-green-600">0%</span> CIT</li>
                          <li>• <strong>Medium</strong> (₦25m - ₦100m): <span className="font-bold text-orange-600">20%</span> CIT</li>
                          <li>• <strong>Large</strong> (Over ₦100m): <span className="font-bold text-red-600">30%</span> CIT</li>
                        </ul>
                        <p className="text-xs text-gray-500 mt-3 pt-3 border-t">Plus 3% Education Tax (EDT) on assessable profits.</p>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                        <h5 className="font-bold text-purple-900 mb-2">Registered as a Business Name</h5>
                        <p className="text-sm text-gray-600 mb-3">
                          Sole Proprietorships/Enterprises do not pay CIT. Instead, the owner pays <strong>Personal Income Tax (PIT)</strong> to their State Internal Revenue Service (e.g., LIRS for Lagos).
                        </p>
                        <p className="text-sm text-gray-700">
                          PIT is calculated on a progressive scale ranging from <strong>7% to 24%</strong> on your taxable business income after allowable deductions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Value Added Tax */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-green-600" />
                      2. Value Added Tax (VAT) - Currently 7.5%
                    </h4>
                    <div className="bg-white p-5 rounded-xl border shadow-sm">
                      <p className="text-gray-700 text-sm leading-relaxed mb-4">
                        VAT is a consumption tax placed on goods and services sold in Nigeria. If you sell physical products online, you are generally required to charge 7.5% VAT at checkout. 
                      </p>
                      <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">The ₦25 Million Exemption Threshold</p>
                          <p className="text-sm text-amber-800 mt-1">
                            According to the Finance Act, businesses with an annual turnover of <strong>less than ₦25 million</strong> are exempt from registering for, charging, and remitting VAT. If your e-commerce store earns below this, you can safely disable the tax calculation setting.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FAQs */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Frequently Asked Questions</h4>
                    <div className="space-y-3">
                      {[
                        {
                          q: "Can I deduct my business expenses?",
                          a: "Yes. Expenses entirely, exclusively, and reasonably incurred for your business (e.g., Facebook Ads, shipping fees, platform hosting) are tax-deductible. Ensure you log them in the 'Expenses' tab."
                        },
                        {
                          q: "When are my tax filings due?",
                          a: "For VAT: The 21st of the month following the transaction. For CIT (LLC): 6 months after your company's financial year-end. For PIT (Business Name): March 31st of every year."
                        },
                        {
                          q: "How do I use this platform to file taxes?",
                          a: "This platform doesn't file taxes directly to FIRS. Instead, use the 'Reports' tab to generate a consolidated CSV/PDF of your revenue, logged expenses, and calculated tax amounts. Hand this report to your accountant or upload it to TaxPro Max."
                        }
                      ].map((faq, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm">
                          <h6 className="font-semibold text-gray-900 text-sm mb-1">Q: {faq.q}</h6>
                          <p className="text-gray-600 text-sm">A: {faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 border-t flex justify-end shrink-0">
                  <Button 
                    onClick={() => setShowTaxGuide(false)}
                    variant="outline"
                    className="border-gray-200"
                  >
                    Close Guide
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}