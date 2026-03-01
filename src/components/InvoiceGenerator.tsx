'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, Download, Image as ImageIcon, X, Save, RotateCcw, FolderOpen, ChevronDown, Copy } from 'lucide-react'

interface LineItem {
    id: string
    description: string
    quantity: number
    rate: number
}

interface InvoiceData {
    // Header
    logo: string | null
    invoiceTitle: string
    // From
    fromName: string
    fromAddress: string
    fromPhone: string
    fromEmail: string
    fromTaxId: string
    // To
    toName: string
    toAddress: string
    toPhone: string
    toEmail: string
    toTaxId: string
    // Invoice details
    invoiceNumber: string
    invoiceDate: string
    dueDate: string
    paymentTerms: string
    // Items
    items: LineItem[]
    // Labels
    itemLabel: string
    quantityLabel: string
    rateLabel: string
    amountLabel: string
    // Calculations
    currency: string
    taxRate: number
    taxType: 'percent' | 'flat'
    discountRate: number
    discountType: 'percent' | 'flat'
    shipping: number
    // Notes
    notes: string
    terms: string
}

interface SavedInvoice {
    id: string
    name: string
    data: InvoiceData
    savedAt: string
    updatedAt: string
}

const defaultInvoice: InvoiceData = {
    logo: null,
    invoiceTitle: 'ใบแจ้งหนี้',
    fromName: '',
    fromAddress: '',
    fromPhone: '',
    fromEmail: '',
    fromTaxId: '',
    toName: '',
    toAddress: '',
    toPhone: '',
    toEmail: '',
    toTaxId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentTerms: '',
    items: [{ id: '1', description: '', quantity: 1, rate: 0 }],
    itemLabel: 'รายการ',
    quantityLabel: 'จำนวน',
    rateLabel: 'ราคา/หน่วย',
    amountLabel: 'จำนวนเงิน',
    currency: '฿',
    taxRate: 7,
    taxType: 'percent',
    discountRate: 0,
    discountType: 'percent',
    shipping: 0,
    notes: '',
    terms: '',
}

const currencies = [
    { symbol: '฿', name: 'THB - บาท' },
    { symbol: '$', name: 'USD - Dollar' },
    { symbol: '€', name: 'EUR - Euro' },
    { symbol: '£', name: 'GBP - Pound' },
    { symbol: '¥', name: 'JPY - Yen' },
]

const STORAGE_KEY = 'invoice-generator-data'
const STORAGE_SAVED_KEY = 'invoice-generator-saved'
const STORAGE_DEFAULTS_KEY = 'invoice-generator-defaults'

export default function InvoiceGenerator() {
    const [invoice, setInvoice] = useState<InvoiceData>(defaultInvoice)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const [showNotice, setShowNotice] = useState<string | null>(null)
    const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([])
    const [currentSaveId, setCurrentSaveId] = useState<string | null>(null)
    const [showSaveDropdown, setShowSaveDropdown] = useState(false)
    const [showLoadDropdown, setShowLoadDropdown] = useState(false)
    const [showSaveAsModal, setShowSaveAsModal] = useState(false)
    const [newSaveName, setNewSaveName] = useState('')
    const invoiceRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const saveDropdownRef = useRef<HTMLDivElement>(null)
    const loadDropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (saveDropdownRef.current && !saveDropdownRef.current.contains(event.target as Node)) {
                setShowSaveDropdown(false)
            }
            if (loadDropdownRef.current && !loadDropdownRef.current.contains(event.target as Node)) {
                setShowLoadDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Load saved data and saved invoices list from localStorage on mount
    useEffect(() => {
        try {
            // Load current working invoice
            const savedData = localStorage.getItem(STORAGE_KEY)
            if (savedData) {
                const parsed = JSON.parse(savedData)
                setInvoice(prev => ({ ...prev, ...parsed.data || parsed }))
                if (parsed.id) {
                    setCurrentSaveId(parsed.id)
                }
            }
            // Load list of saved invoices
            const savedList = localStorage.getItem(STORAGE_SAVED_KEY)
            if (savedList) {
                setSavedInvoices(JSON.parse(savedList))
            }
        } catch (error) {
            console.error('Error loading saved invoice data:', error)
        }
        setIsLoaded(true)
    }, [])

    // Auto-save to localStorage whenever invoice changes
    useEffect(() => {
        if (!isLoaded) return
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                id: currentSaveId,
                data: invoice
            }))
        } catch (error) {
            console.error('Error saving invoice data:', error)
        }
    }, [invoice, isLoaded, currentSaveId])

    // Show notification
    const showNotification = useCallback((message: string) => {
        setShowNotice(message)
        setTimeout(() => setShowNotice(null), 2000)
    }, [])

    // Save current invoice (update existing or prompt for new)
    const saveInvoice = useCallback(() => {
        if (currentSaveId) {
            // Update existing save
            const updatedList = savedInvoices.map(saved =>
                saved.id === currentSaveId
                    ? { ...saved, data: invoice, updatedAt: new Date().toISOString() }
                    : saved
            )
            setSavedInvoices(updatedList)
            localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updatedList))
            showNotification('บันทึกแล้ว')
        } else {
            // Open save as modal
            setNewSaveName(invoice.invoiceNumber || invoice.toName || 'ใบแจ้งหนี้ใหม่')
            setShowSaveAsModal(true)
        }
        setShowSaveDropdown(false)
    }, [currentSaveId, savedInvoices, invoice, showNotification])

    // Save as new invoice
    const saveAsNewInvoice = useCallback(() => {
        const name = newSaveName.trim() || 'ใบแจ้งหนี้ใหม่'
        const newSave: SavedInvoice = {
            id: Date.now().toString(),
            name,
            data: invoice,
            savedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        const updatedList = [...savedInvoices, newSave]
        setSavedInvoices(updatedList)
        setCurrentSaveId(newSave.id)
        localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updatedList))
        setShowSaveAsModal(false)
        setNewSaveName('')
        showNotification('บันทึกใหม่แล้ว')
    }, [newSaveName, invoice, savedInvoices, showNotification])

    // Load a saved invoice
    const loadSavedInvoice = useCallback((saved: SavedInvoice) => {
        setInvoice(saved.data)
        setCurrentSaveId(saved.id)
        setShowLoadDropdown(false)
        showNotification(`โหลด "${saved.name}" แล้ว`)
    }, [showNotification])

    // Delete a saved invoice
    const deleteSavedInvoice = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('ต้องการลบใบแจ้งหนี้ที่บันทึกไว้นี้?')) return
        const updatedList = savedInvoices.filter(saved => saved.id !== id)
        setSavedInvoices(updatedList)
        localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updatedList))
        if (currentSaveId === id) {
            setCurrentSaveId(null)
        }
        showNotification('ลบแล้ว')
    }, [savedInvoices, currentSaveId, showNotification])

    // Duplicate current invoice
    const duplicateInvoice = useCallback(() => {
        setCurrentSaveId(null)
        setNewSaveName(`${invoice.invoiceNumber || invoice.toName || 'ใบแจ้งหนี้'} (สำเนา)`)
        setShowSaveAsModal(true)
        setShowSaveDropdown(false)
    }, [invoice])

    // Save current "From" section as defaults
    const saveAsDefaults = useCallback(() => {
        try {
            const defaults = {
                logo: invoice.logo,
                invoiceTitle: invoice.invoiceTitle,
                fromName: invoice.fromName,
                fromAddress: invoice.fromAddress,
                fromPhone: invoice.fromPhone,
                fromEmail: invoice.fromEmail,
                fromTaxId: invoice.fromTaxId,
                currency: invoice.currency,
                taxRate: invoice.taxRate,
                taxType: invoice.taxType,
                notes: invoice.notes,
                terms: invoice.terms,
                itemLabel: invoice.itemLabel,
                quantityLabel: invoice.quantityLabel,
                rateLabel: invoice.rateLabel,
                amountLabel: invoice.amountLabel,
            }
            localStorage.setItem(STORAGE_DEFAULTS_KEY, JSON.stringify(defaults))
            showNotification('บันทึกค่าเริ่มต้นแล้ว')
        } catch (error) {
            console.error('Error saving defaults:', error)
        }
        setShowSaveDropdown(false)
    }, [invoice, showNotification])

    // Reset form to clean state
    const resetForm = useCallback(() => {
        setCurrentSaveId(null)
        try {
            const savedDefaults = localStorage.getItem(STORAGE_DEFAULTS_KEY)
            if (savedDefaults) {
                const defaults = JSON.parse(savedDefaults)
                setInvoice({
                    ...defaultInvoice,
                    ...defaults,
                    toName: '',
                    toAddress: '',
                    toPhone: '',
                    toEmail: '',
                    toTaxId: '',
                    invoiceNumber: '',
                    invoiceDate: new Date().toISOString().split('T')[0],
                    dueDate: '',
                    paymentTerms: '',
                    items: [{ id: '1', description: '', quantity: 1, rate: 0 }],
                    discountRate: 0,
                    shipping: 0,
                })
            } else {
                setInvoice({
                    ...defaultInvoice,
                    invoiceDate: new Date().toISOString().split('T')[0],
                })
            }
        } catch (error) {
            setInvoice({
                ...defaultInvoice,
                invoiceDate: new Date().toISOString().split('T')[0],
            })
        }
        showNotification('รีเซ็ตแล้ว')
    }, [showNotification])

    const updateInvoice = useCallback((updates: Partial<InvoiceData>) => {
        setInvoice(prev => ({ ...prev, ...updates }))
    }, [])

    const addItem = useCallback(() => {
        setInvoice(prev => ({
            ...prev,
            items: [...prev.items, { id: Date.now().toString(), description: '', quantity: 1, rate: 0 }]
        }))
    }, [])

    const removeItem = useCallback((id: string) => {
        setInvoice(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id)
        }))
    }, [])

    const updateItem = useCallback((id: string, field: keyof LineItem, value: string | number) => {
        setInvoice(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }))
    }, [])

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                updateInvoice({ logo: event.target?.result as string })
            }
            reader.readAsDataURL(file)
        }
    }

    const removeLogo = () => {
        updateInvoice({ logo: null })
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Calculations
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
    const discountAmount = invoice.discountType === 'percent'
        ? subtotal * (invoice.discountRate / 100)
        : invoice.discountRate
    const afterDiscount = subtotal - discountAmount
    const taxAmount = invoice.taxType === 'percent'
        ? afterDiscount * (invoice.taxRate / 100)
        : invoice.taxRate
    const total = afterDiscount + taxAmount + invoice.shipping

    const formatCurrency = (amount: number) => {
        return `${invoice.currency}${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const generatePDF = async () => {
        if (!invoiceRef.current) return
        setIsGenerating(true)

        try {
            const html2pdf = (await import('html2pdf.js')).default
            const element = invoiceRef.current
            const opt = {
                margin: 10,
                filename: `invoice-${invoice.invoiceNumber || 'draft'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait' as const
                }
            }
            await html2pdf().set(opt).from(element).save()
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert('เกิดข้อผิดพลาดในการสร้าง PDF')
        } finally {
            setIsGenerating(false)
        }
    }

    // Get current save name
    const currentSaveName = currentSaveId
        ? savedInvoices.find(s => s.id === currentSaveId)?.name
        : null

    return (
        <div className="min-h-screen bg-zinc-100">
            {/* Notice Toast */}
            {showNotice && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
                    {showNotice}
                </div>
            )}

            {/* Save As Modal */}
            {showSaveAsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-800 mb-4">บันทึกใบแจ้งหนี้</h3>
                        <input
                            type="text"
                            placeholder="ชื่อที่จะบันทึก"
                            value={newSaveName}
                            onChange={(e) => setNewSaveName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveAsNewInvoice()}
                            autoFocus
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowSaveAsModal(false)}
                                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={saveAsNewInvoice}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-semibold text-zinc-800">สร้างใบแจ้งหนี้</h1>
                        {currentSaveName && (
                            <span className="text-sm text-zinc-500 bg-zinc-100 px-2 py-1 rounded">
                                {currentSaveName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* New Invoice Button */}
                        <button
                            onClick={resetForm}
                            className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-zinc-100 font-medium rounded-lg transition-colors"
                            title="สร้างใบใหม่"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span className="hidden sm:inline">ใบใหม่</span>
                        </button>

                        {/* Load Dropdown */}
                        <div className="relative" ref={loadDropdownRef}>
                            <button
                                onClick={() => {
                                    setShowLoadDropdown(!showLoadDropdown)
                                    setShowSaveDropdown(false)
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-zinc-100 font-medium rounded-lg transition-colors"
                                title="โหลดใบแจ้งหนี้"
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="hidden sm:inline">โหลด</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showLoadDropdown && (
                                <div className="absolute right-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-30">
                                    {savedInvoices.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                                            ยังไม่มีใบแจ้งหนี้ที่บันทึกไว้
                                        </div>
                                    ) : (
                                        <div className="max-h-64 overflow-y-auto">
                                            {savedInvoices.map((saved) => (
                                                <div
                                                    key={saved.id}
                                                    onClick={() => loadSavedInvoice(saved)}
                                                    className={`px-4 py-2 hover:bg-zinc-50 cursor-pointer flex items-center justify-between group ${currentSaveId === saved.id ? 'bg-green-50' : ''
                                                        }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-zinc-800 truncate">
                                                            {saved.name}
                                                        </p>
                                                        <p className="text-xs text-zinc-400">
                                                            {formatDate(saved.updatedAt)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => deleteSavedInvoice(saved.id, e)}
                                                        className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Save Dropdown */}
                        <div className="relative" ref={saveDropdownRef}>
                            <button
                                onClick={() => {
                                    setShowSaveDropdown(!showSaveDropdown)
                                    setShowLoadDropdown(false)
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-zinc-100 font-medium rounded-lg transition-colors"
                                title="บันทึก"
                            >
                                <Save className="w-4 h-4" />
                                <span className="hidden sm:inline">บันทึก</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showSaveDropdown && (
                                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-30">
                                    <button
                                        onClick={saveInvoice}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4 text-zinc-500" />
                                        {currentSaveId ? 'บันทึก' : 'บันทึกใหม่'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setNewSaveName(invoice.invoiceNumber || invoice.toName || 'ใบแจ้งหนี้ใหม่')
                                            setShowSaveAsModal(true)
                                            setShowSaveDropdown(false)
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4 text-zinc-500" />
                                        บันทึกเป็นใบใหม่
                                    </button>
                                    {currentSaveId && (
                                        <button
                                            onClick={duplicateInvoice}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-2"
                                        >
                                            <Copy className="w-4 h-4 text-zinc-500" />
                                            ทำสำเนา
                                        </button>
                                    )}
                                    <div className="border-t border-zinc-100 my-1" />
                                    <button
                                        onClick={saveAsDefaults}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-2 text-zinc-600"
                                    >
                                        <Save className="w-4 h-4" />
                                        บันทึกข้อมูลผู้ออกเป็นค่าเริ่มต้น
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Download PDF */}
                        <button
                            onClick={generatePDF}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            {isGenerating ? 'กำลังสร้าง...' : 'ดาวน์โหลด PDF'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 lg:p-6">
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Form */}
                    <div className="space-y-4">
                        {/* Invoice Title & Logo */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                                        ชื่อเอกสาร
                                    </label>
                                    <input
                                        type="text"
                                        value={invoice.invoiceTitle}
                                        onChange={(e) => updateInvoice({ invoiceTitle: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                                        โลโก้
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                        />
                                        {invoice.logo ? (
                                            <div className="flex items-center gap-2">
                                                <img src={invoice.logo} alt="Logo" className="h-10 object-contain" />
                                                <button
                                                    onClick={removeLogo}
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-zinc-400 hover:text-zinc-600"
                                            >
                                                <ImageIcon className="w-4 h-4" />
                                                อัปโหลดโลโก้
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* From Section */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-zinc-800">จาก (ผู้ออกใบแจ้งหนี้)</h2>
                                <span className="text-xs text-zinc-400">จะถูกบันทึกอัตโนมัติ</span>
                            </div>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="ชื่อบริษัท / ชื่อผู้ออก"
                                    value={invoice.fromName}
                                    onChange={(e) => updateInvoice({ fromName: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                                <textarea
                                    placeholder="ที่อยู่"
                                    rows={2}
                                    value={invoice.fromAddress}
                                    onChange={(e) => updateInvoice({ fromAddress: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="โทรศัพท์"
                                        value={invoice.fromPhone}
                                        onChange={(e) => updateInvoice({ fromPhone: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                    <input
                                        type="email"
                                        placeholder="อีเมล"
                                        value={invoice.fromEmail}
                                        onChange={(e) => updateInvoice({ fromEmail: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="เลขประจำตัวผู้เสียภาษี"
                                    value={invoice.fromTaxId}
                                    onChange={(e) => updateInvoice({ fromTaxId: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                        </div>

                        {/* To Section */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-zinc-800 mb-3">ถึง (ลูกค้า)</h2>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="ชื่อลูกค้า / ชื่อบริษัท"
                                    value={invoice.toName}
                                    onChange={(e) => updateInvoice({ toName: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                                <textarea
                                    placeholder="ที่อยู่"
                                    rows={2}
                                    value={invoice.toAddress}
                                    onChange={(e) => updateInvoice({ toAddress: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="โทรศัพท์"
                                        value={invoice.toPhone}
                                        onChange={(e) => updateInvoice({ toPhone: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                    <input
                                        type="email"
                                        placeholder="อีเมล"
                                        value={invoice.toEmail}
                                        onChange={(e) => updateInvoice({ toEmail: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="เลขประจำตัวผู้เสียภาษี"
                                    value={invoice.toTaxId}
                                    onChange={(e) => updateInvoice({ toTaxId: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                        </div>

                        {/* Invoice Details */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-zinc-800 mb-3">รายละเอียดใบแจ้งหนี้</h2>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">เลขที่ใบแจ้งหนี้</label>
                                    <input
                                        type="text"
                                        value={invoice.invoiceNumber}
                                        onChange={(e) => updateInvoice({ invoiceNumber: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">วันที่ออก</label>
                                    <input
                                        type="date"
                                        value={invoice.invoiceDate}
                                        onChange={(e) => updateInvoice({ invoiceDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">กำหนดชำระ</label>
                                    <input
                                        type="date"
                                        value={invoice.dueDate}
                                        onChange={(e) => updateInvoice({ dueDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">เงื่อนไขการชำระ</label>
                                    <input
                                        type="text"
                                        placeholder="เช่น Net 30"
                                        value={invoice.paymentTerms}
                                        onChange={(e) => updateInvoice({ paymentTerms: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-zinc-800 mb-3">รายการ</h2>

                            {/* Item Labels */}
                            <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-zinc-500">
                                <div className="col-span-5">{invoice.itemLabel}</div>
                                <div className="col-span-2">{invoice.quantityLabel}</div>
                                <div className="col-span-3">{invoice.rateLabel}</div>
                                <div className="col-span-2">{invoice.amountLabel}</div>
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                                {invoice.items.map((item) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="รายละเอียด"
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            className="col-span-5 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="col-span-2 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-center"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.rate}
                                            onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                            className="col-span-3 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                        />
                                        <div className="col-span-2 flex items-center justify-between">
                                            <span className="text-sm font-medium text-zinc-700">
                                                {formatCurrency(item.quantity * item.rate)}
                                            </span>
                                            {invoice.items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={addItem}
                                className="mt-3 flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                            >
                                <Plus className="w-4 h-4" />
                                เพิ่มรายการ
                            </button>
                        </div>

                        {/* Tax, Discount, Shipping */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-zinc-800 mb-3">ค่าใช้จ่ายเพิ่มเติม</h2>
                            <div className="space-y-3">
                                {/* Currency */}
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">สกุลเงิน</label>
                                    <select
                                        value={invoice.currency}
                                        onChange={(e) => updateInvoice({ currency: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    >
                                        {currencies.map((c) => (
                                            <option key={c.symbol} value={c.symbol}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Discount */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs text-zinc-500 mb-1">ส่วนลด</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={invoice.discountRate}
                                            onChange={(e) => updateInvoice({ discountRate: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-xs text-zinc-500 mb-1">ประเภท</label>
                                        <select
                                            value={invoice.discountType}
                                            onChange={(e) => updateInvoice({ discountType: e.target.value as 'percent' | 'flat' })}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        >
                                            <option value="percent">%</option>
                                            <option value="flat">{invoice.currency}</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Tax */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs text-zinc-500 mb-1">ภาษี</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={invoice.taxRate}
                                            onChange={(e) => updateInvoice({ taxRate: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-xs text-zinc-500 mb-1">ประเภท</label>
                                        <select
                                            value={invoice.taxType}
                                            onChange={(e) => updateInvoice({ taxType: e.target.value as 'percent' | 'flat' })}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        >
                                            <option value="percent">%</option>
                                            <option value="flat">{invoice.currency}</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Shipping */}
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">ค่าจัดส่ง</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={invoice.shipping}
                                        onChange={(e) => updateInvoice({ shipping: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notes & Terms */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">หมายเหตุ</label>
                                    <textarea
                                        placeholder="หมายเหตุเพิ่มเติม..."
                                        rows={2}
                                        value={invoice.notes}
                                        onChange={(e) => updateInvoice({ notes: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">เงื่อนไข</label>
                                    <textarea
                                        placeholder="เงื่อนไขการชำระเงิน..."
                                        rows={2}
                                        value={invoice.terms}
                                        onChange={(e) => updateInvoice({ terms: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="lg:sticky lg:top-20 lg:h-fit">
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200">
                                <span className="text-sm font-medium text-zinc-600">ตัวอย่างใบแจ้งหนี้</span>
                            </div>
                            <div className="p-4 overflow-auto max-h-[calc(100vh-160px)]">
                                {/* Invoice Preview */}
                                <div
                                    ref={invoiceRef}
                                    className="bg-white p-8 shadow-lg border border-zinc-200 text-sm"
                                    style={{ fontFamily: 'Kanit, sans-serif', minWidth: '595px' }}
                                >
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            {invoice.logo && (
                                                <img src={invoice.logo} alt="Logo" className="h-16 object-contain mb-2" />
                                            )}
                                            <h1 className="text-2xl font-bold text-zinc-800">{invoice.invoiceTitle}</h1>
                                        </div>
                                        <div className="text-right">
                                            {invoice.invoiceNumber && (
                                                <p className="text-zinc-600">
                                                    <span className="font-medium">เลขที่:</span> {invoice.invoiceNumber}
                                                </p>
                                            )}
                                            {invoice.invoiceDate && (
                                                <p className="text-zinc-600">
                                                    <span className="font-medium">วันที่:</span> {new Date(invoice.invoiceDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                            )}
                                            {invoice.dueDate && (
                                                <p className="text-zinc-600">
                                                    <span className="font-medium">กำหนดชำระ:</span> {new Date(invoice.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                            )}
                                            {invoice.paymentTerms && (
                                                <p className="text-zinc-600">
                                                    <span className="font-medium">เงื่อนไข:</span> {invoice.paymentTerms}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* From / To */}
                                    <div className="grid grid-cols-2 gap-8 mb-8">
                                        <div>
                                            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">จาก</h3>
                                            <div className="text-zinc-800">
                                                {invoice.fromName && <p className="font-semibold">{invoice.fromName}</p>}
                                                {invoice.fromAddress && <p className="whitespace-pre-line">{invoice.fromAddress}</p>}
                                                {invoice.fromPhone && <p>โทร: {invoice.fromPhone}</p>}
                                                {invoice.fromEmail && <p>อีเมล: {invoice.fromEmail}</p>}
                                                {invoice.fromTaxId && <p>เลขผู้เสียภาษี: {invoice.fromTaxId}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">ถึง</h3>
                                            <div className="text-zinc-800">
                                                {invoice.toName && <p className="font-semibold">{invoice.toName}</p>}
                                                {invoice.toAddress && <p className="whitespace-pre-line">{invoice.toAddress}</p>}
                                                {invoice.toPhone && <p>โทร: {invoice.toPhone}</p>}
                                                {invoice.toEmail && <p>อีเมล: {invoice.toEmail}</p>}
                                                {invoice.toTaxId && <p>เลขผู้เสียภาษี: {invoice.toTaxId}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <table className="w-full mb-8">
                                        <thead>
                                            <tr className="border-b-2 border-zinc-300">
                                                <th className="text-left py-2 font-semibold text-zinc-700">{invoice.itemLabel}</th>
                                                <th className="text-center py-2 font-semibold text-zinc-700 w-20">{invoice.quantityLabel}</th>
                                                <th className="text-right py-2 font-semibold text-zinc-700 w-28">{invoice.rateLabel}</th>
                                                <th className="text-right py-2 font-semibold text-zinc-700 w-28">{invoice.amountLabel}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoice.items.map((item) => (
                                                <tr key={item.id} className="border-b border-zinc-200">
                                                    <td className="py-3 text-zinc-800">{item.description || '-'}</td>
                                                    <td className="py-3 text-center text-zinc-800">{item.quantity}</td>
                                                    <td className="py-3 text-right text-zinc-800">{formatCurrency(item.rate)}</td>
                                                    <td className="py-3 text-right text-zinc-800">{formatCurrency(item.quantity * item.rate)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Totals */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-64">
                                            <div className="flex justify-between py-2 border-b border-zinc-200">
                                                <span className="text-zinc-600">ยอดรวม</span>
                                                <span className="text-zinc-800">{formatCurrency(subtotal)}</span>
                                            </div>
                                            {discountAmount > 0 && (
                                                <div className="flex justify-between py-2 border-b border-zinc-200">
                                                    <span className="text-zinc-600">
                                                        ส่วนลด {invoice.discountType === 'percent' ? `(${invoice.discountRate}%)` : ''}
                                                    </span>
                                                    <span className="text-red-600">-{formatCurrency(discountAmount)}</span>
                                                </div>
                                            )}
                                            {taxAmount > 0 && (
                                                <div className="flex justify-between py-2 border-b border-zinc-200">
                                                    <span className="text-zinc-600">
                                                        ภาษี {invoice.taxType === 'percent' ? `(${invoice.taxRate}%)` : ''}
                                                    </span>
                                                    <span className="text-zinc-800">{formatCurrency(taxAmount)}</span>
                                                </div>
                                            )}
                                            {invoice.shipping > 0 && (
                                                <div className="flex justify-between py-2 border-b border-zinc-200">
                                                    <span className="text-zinc-600">ค่าจัดส่ง</span>
                                                    <span className="text-zinc-800">{formatCurrency(invoice.shipping)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between py-3 border-b-2 border-zinc-300">
                                                <span className="font-bold text-zinc-800">ยอดรวมสุทธิ</span>
                                                <span className="font-bold text-zinc-800 text-lg">{formatCurrency(total)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes & Terms */}
                                    {(invoice.notes || invoice.terms) && (
                                        <div className="border-t border-zinc-200 pt-4 space-y-3">
                                            {invoice.notes && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">หมายเหตุ</h4>
                                                    <p className="text-zinc-700 whitespace-pre-line">{invoice.notes}</p>
                                                </div>
                                            )}
                                            {invoice.terms && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">เงื่อนไข</h4>
                                                    <p className="text-zinc-700 whitespace-pre-line">{invoice.terms}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
