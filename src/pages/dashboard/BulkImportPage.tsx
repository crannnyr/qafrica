import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileSpreadsheet, Download, Check, X, 
  AlertCircle, Package, Loader2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { productService } from '@/services';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ImportProduct {
  name: string;
  description: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  sku?: string;
  tags?: string;
  image_url?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  image_url_5?: string;
  errors?: string[];
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const REQUIRED_COLUMNS = ['name', 'description', 'category', 'cost_price', 'selling_price', 'stock_quantity'];
const OPTIONAL_COLUMNS = ['sku', 'tags', 'image_url', 'image_url_2', 'image_url_3', 'image_url_4', 'image_url_5'];
const SAMPLE_CSV = `name,description,category,cost_price,selling_price,stock_quantity,sku,tags,image_url,image_url_2,image_url_3
"Wireless Bluetooth Headphones","High-quality wireless headphones with noise cancellation","Electronics",15000,25000,50,"WH-001","headphones,bluetooth,audio","https://example.com/image1.jpg","https://example.com/image2.jpg",""
"Phone Case iPhone 15","Premium silicone case for iPhone 15","Accessories",2000,5000,100,"PC-IPH15","phone case,iphone,accessories","https://example.com/case1.jpg","",""
"USB-C Cable 2m","Fast charging USB-C cable, 2 meters","Accessories",1500,3500,200,"USB-2M","cable,charging,usb-c","https://example.com/cable.jpg","",""`;

export default function BulkImportPage() {
  const { currentStore } = useStoreStore();
  const [isDragging, setIsDragging] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ImportProduct[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    try {
      const data = await file.arrayBuffer();
      let products: ImportProduct[] = [];

      if (extension === 'csv') {
        products = parseCSV(await file.text());
      } else {
        products = parseExcel(data);
      }

      // Validate products
      const validatedProducts = products.map((product) => {
        const errors: string[] = [];
        
        if (!product.name?.trim()) errors.push('Name is required');
        if (!product.description?.trim()) errors.push('Description is required');
        if (!product.category?.trim()) errors.push('Category is required');
        if (!product.cost_price || product.cost_price <= 0) errors.push('Valid cost price is required');
        if (!product.selling_price || product.selling_price <= 0) errors.push('Valid selling price is required');
        if (product.selling_price <= product.cost_price) errors.push('Selling price must be higher than cost price');
        if (product.stock_quantity === undefined || product.stock_quantity < 0) errors.push('Valid stock quantity is required');

        return { ...product, errors };
      });

      setParsedProducts(validatedProducts);
      setCurrentStep('preview');
      
      const validCount = validatedProducts.filter(p => !p.errors?.length).length;
      toast.success(`Parsed ${validCount} valid products out of ${validatedProducts.length}`);
    } catch (error) {
      toast.error('Failed to parse file. Please check the format.');
    }
  };

  const parseCSV = (text: string): ImportProduct[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Validate headers
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const products: ImportProduct[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const product: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim().replace(/^"|"$/g, '') || '';
        
        switch (header) {
          case 'cost_price':
          case 'selling_price':
            product[header] = parseFloat(value) || 0;
            break;
          case 'stock_quantity':
            product[header] = parseInt(value) || 0;
            break;
          default:
            product[header] = value;
        }
      });
      
      products.push(product as ImportProduct);
    }
    
    return products;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const parseExcel = (data: ArrayBuffer): ImportProduct[] => {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      throw new Error('File is empty or has no data rows');
    }

    const headers = jsonData[0].map(h => String(h).trim());
    
    // Validate headers
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const products: ImportProduct[] = [];
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const product: any = {};
      
      headers.forEach((header, index) => {
        const value = row[index];
        
        switch (header) {
          case 'cost_price':
          case 'selling_price':
            product[header] = typeof value === 'number' ? value : parseFloat(value) || 0;
            break;
          case 'stock_quantity':
            product[header] = typeof value === 'number' ? value : parseInt(value) || 0;
            break;
          default:
            product[header] = value ? String(value) : '';
        }
      });
      
      products.push(product as ImportProduct);
    }
    
    return products;
  };

  const handleImport = async () => {
    if (!currentStore?.id) {
      toast.error('No store selected');
      return;
    }

    const validProducts = parsedProducts.filter(p => !p.errors?.length);
    
    if (validProducts.length === 0) {
      toast.error('No valid products to import');
      return;
    }

    setIsImporting(true);
    
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < validProducts.length; i++) {
      const product = validProducts[i];
      
      try {
        // Collect image URLs
        const images: string[] = [];
        if (product.image_url) images.push(product.image_url);
        if (product.image_url_2) images.push(product.image_url_2);
        if (product.image_url_3) images.push(product.image_url_3);
        if (product.image_url_4) images.push(product.image_url_4);
        if (product.image_url_5) images.push(product.image_url_5);

        const { error } = await productService.createProduct({
          store_id: currentStore.id,
          owner_id: currentStore.owner_id,
          name: product.name,
          description: product.description,
          category: product.category,
          niche: currentStore.niches[0] || 'general',
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          dropship_price: Math.round(product.selling_price * 0.9),
          wholesale_price: Math.round(product.selling_price * 0.85),
          stock_quantity: product.stock_quantity,
          low_stock_threshold: 10,
          sku: product.sku || undefined,
          tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
          is_active: true,
          is_importable: false,
          import_count: 0,
          has_variants: false,
          images,
          views: 0,
          sales_count: 0,
        });

        if (error) throw error;
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          message: error.message || 'Failed to create product',
        });
      }
    }

    setImportResult(result);
    setIsImporting(false);
    setCurrentStep('result');

    if (result.success > 0) {
      toast.success(`Successfully imported ${result.success} products!`);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'description', 'category', 'cost_price', 'selling_price', 'stock_quantity', 'sku', 'tags', 'image_url', 'image_url_2', 'image_url_3', 'image_url_4', 'image_url_5'],
      ['Wireless Bluetooth Headphones', 'High-quality wireless headphones with noise cancellation', 'Electronics', 15000, 25000, 50, 'WH-001', 'headphones,bluetooth,audio', 'https://example.com/image1.jpg', 'https://example.com/image2.jpg', '', '', ''],
      ['Phone Case iPhone 15', 'Premium silicone case for iPhone 15', 'Accessories', 2000, 5000, 100, 'PC-IPH15', 'phone case,iphone,accessories', 'https://example.com/case1.jpg', '', '', '', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product_import_template.xlsx');
  };

  const resetImport = () => {
    setParsedProducts([]);
    setImportResult(null);
    setCurrentStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Product Import</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Import multiple products at once using CSV or Excel files
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {[
          { key: 'upload', label: 'Upload File' },
          { key: 'preview', label: 'Preview' },
          { key: 'result', label: 'Results' },
        ].map((step, index) => (
          <div key={step.key} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === step.key
                ? 'bg-orange-500 text-white'
                : index < ['upload', 'preview', 'result'].indexOf(currentStep)
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
            }`}>
              {index < ['upload', 'preview', 'result'].indexOf(currentStep) ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <span className={`text-sm ${
              currentStep === step.key ? 'text-orange-600 font-medium' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
            {index < 2 && <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Template Download */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              Download Template
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Download our template file to ensure your data is formatted correctly.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                CSV Template
              </Button>
              <Button variant="outline" onClick={downloadExcelTemplate}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel Template
              </Button>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className={`w-16 h-16 mx-auto mb-4 ${
              isDragging ? 'text-orange-500' : 'text-gray-400'
            }`} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              or click to browse (CSV, Excel files only)
            </p>
            <p className="text-sm text-gray-400">
              Maximum file size: 10MB
            </p>
          </div>

          {/* Required Fields */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Required Fields</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {REQUIRED_COLUMNS.map(field => (
                <div key={field} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{field}</span>
                </div>
              ))}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">Optional Fields</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {OPTIONAL_COLUMNS.map(field => (
                <div key={field} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-xs text-gray-500">+</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{field}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Up to 5 image URLs can be provided (image_url, image_url_2, image_url_3, image_url_4, image_url_5)
            </p>
          </div>
        </motion.div>
      )}

      {/* Preview Step */}
      {currentStep === 'preview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{parsedProducts.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Valid</p>
              <p className="text-2xl font-bold text-green-600">
                {parsedProducts.filter(p => !p.errors?.length).length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Invalid</p>
              <p className="text-2xl font-bold text-red-600">
                {parsedProducts.filter(p => p.errors?.length).length}
              </p>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Cost</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Stock</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {parsedProducts.map((product, index) => (
                    <tr key={index} className={product.errors && product.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{product.name}</p>
                        {product.errors && product.errors.length > 0 && (
                          <p className="text-xs text-red-600 mt-1">{product.errors.join(', ')}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{product.category}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        ₦{product.cost_price?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        ₦{product.selling_price?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{product.stock_quantity}</td>
                      <td className="px-4 py-3">
                        {product.errors?.length ? (
                          <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                            <X className="w-4 h-4" /> Invalid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                            <Check className="w-4 h-4" /> Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetImport}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || parsedProducts.filter(p => !p.errors?.length).length === 0}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Import {parsedProducts.filter(p => !p.errors?.length).length} Products
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Result Step */}
      {currentStep === 'result' && importResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Result Summary */}
          <div className={`rounded-xl p-8 text-center ${
            importResult.failed === 0
              ? 'bg-green-50 dark:bg-green-900/20'
              : importResult.success === 0
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-yellow-50 dark:bg-yellow-900/20'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              importResult.failed === 0
                ? 'bg-green-500'
                : importResult.success === 0
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}>
              {importResult.failed === 0 ? (
                <Check className="w-8 h-8 text-white" />
              ) : importResult.success === 0 ? (
                <X className="w-8 h-8 text-white" />
              ) : (
                <AlertCircle className="w-8 h-8 text-white" />
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {importResult.failed === 0
                ? 'Import Successful!'
                : importResult.success === 0
                ? 'Import Failed'
                : 'Import Partially Successful'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {importResult.success} products imported successfully
              {importResult.failed > 0 && `, ${importResult.failed} failed`}
            </p>
          </div>

          {/* Error Details */}
          {importResult.errors.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <h4 className="font-medium text-red-800 dark:text-red-200">Error Details</h4>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                <ul className="space-y-2">
                  {importResult.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-600">
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetImport} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Import More Products
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
