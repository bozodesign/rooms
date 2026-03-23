'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, Download, Image as ImageIcon, X, Save, RotateCcw, FolderOpen, ChevronDown, Copy, Loader2, Upload, Receipt } from 'lucide-react'

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

type InvoiceType = 'invoice' | 'receipt' | 'deposit_receipt' | 'quotation'

interface SavedInvoice {
    id: string
    name: string
    type: InvoiceType
    data: InvoiceData
    updatedAt: string
    createdAt: string
}

const invoiceTypes: { value: InvoiceType; label: string; title: string }[] = [
    { value: 'invoice', label: 'ใบแจ้งหนี้', title: 'ใบแจ้งหนี้' },
    { value: 'receipt', label: 'ใบเสร็จรับเงิน', title: 'ใบเสร็จรับเงิน' },
    { value: 'deposit_receipt', label: 'ใบเสร็จรับเงินมัดจำ', title: 'ใบเสร็จรับเงินมัดจำ' },
    { value: 'quotation', label: 'ใบเสนอราคา', title: 'ใบเสนอราคา' },
]

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
    taxRate: 0,
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

export default function InvoiceGenerator() {
    const [invoice, setInvoice] = useState<InvoiceData>(defaultInvoice)
    const [invoiceType, setInvoiceType] = useState<InvoiceType>('invoice')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showNotice, setShowNotice] = useState<string | null>(null)
    const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([])
    const [currentSaveId, setCurrentSaveId] = useState<string | null>(null)
    const [showSaveDropdown, setShowSaveDropdown] = useState(false)
    const [showLoadDropdown, setShowLoadDropdown] = useState(false)
    const [showSaveAsModal, setShowSaveAsModal] = useState(false)
    const [newSaveName, setNewSaveName] = useState('')
    const [showMigrationModal, setShowMigrationModal] = useState(false)
    const [localStorageData, setLocalStorageData] = useState<{ invoices: Array<{ name: string; data: InvoiceData }>; defaults: Record<string, unknown> | null } | null>(null)
    const [isMigrating, setIsMigrating] = useState(false)
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

    // Load saved invoices list from API on mount
    useEffect(() => {
        const loadSavedList = async () => {
            try {
                const res = await fetch('/api/invoice-generator')
                if (res.ok) {
                    const data = await res.json()
                    setSavedInvoices(data.invoices || [])
                }
            } catch (error) {
                console.error('Error loading saved invoices:', error)
            }
        }

        const loadDefaults = async () => {
            try {
                const res = await fetch('/api/invoice-generator/defaults')
                if (res.ok) {
                    const data = await res.json()
                    if (data.defaults) {
                        setInvoice(prev => ({
                            ...prev,
                            ...data.defaults,
                            invoiceDate: new Date().toISOString().split('T')[0],
                        }))
                    }
                }
            } catch (error) {
                console.error('Error loading defaults:', error)
            }
        }

        // Check for localStorage data to migrate
        const checkLocalStorage = () => {
            try {
                const STORAGE_SAVED_KEY = 'invoice-generator-saved'
                const STORAGE_DEFAULTS_KEY = 'invoice-generator-defaults'
                const savedList = localStorage.getItem(STORAGE_SAVED_KEY)
                const savedDefaults = localStorage.getItem(STORAGE_DEFAULTS_KEY)

                if (savedList || savedDefaults) {
                    const invoices = savedList ? JSON.parse(savedList) : []
                    const defaults = savedDefaults ? JSON.parse(savedDefaults) : null
                    if (invoices.length > 0 || defaults) {
                        setLocalStorageData({ invoices, defaults })
                        setShowMigrationModal(true)
                    }
                }
            } catch (error) {
                console.error('Error checking localStorage:', error)
            }
        }

        Promise.all([loadSavedList(), loadDefaults()]).finally(() => {
            setIsLoaded(true)
            checkLocalStorage()
        })
    }, [])

    // Update invoice title when type changes
    useEffect(() => {
        const typeConfig = invoiceTypes.find(t => t.value === invoiceType)
        if (typeConfig && !currentSaveId) {
            setInvoice(prev => ({
                ...prev,
                invoiceTitle: typeConfig.title
            }))
        }
    }, [invoiceType, currentSaveId])

    // Show notification
    const showNotification = useCallback((message: string) => {
        setShowNotice(message)
        setTimeout(() => setShowNotice(null), 2000)
    }, [])

    // Refresh saved invoices list
    const refreshSavedList = useCallback(async () => {
        try {
            const res = await fetch('/api/invoice-generator')
            if (res.ok) {
                const data = await res.json()
                setSavedInvoices(data.invoices || [])
            }
        } catch (error) {
            console.error('Error refreshing saved invoices:', error)
        }
    }, [])

    // Migrate data from localStorage to MongoDB
    const migrateFromLocalStorage = useCallback(async () => {
        if (!localStorageData) return

        setIsMigrating(true)
        try {
            // Migrate defaults first
            if (localStorageData.defaults) {
                await fetch('/api/invoice-generator/defaults', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ defaults: localStorageData.defaults }),
                })
            }

            // Migrate saved invoices
            for (const saved of localStorageData.invoices) {
                await fetch('/api/invoice-generator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: saved.name,
                        type: 'invoice',
                        data: saved.data,
                    }),
                })
            }

            // Clear localStorage after migration
            localStorage.removeItem('invoice-generator-saved')
            localStorage.removeItem('invoice-generator-defaults')
            localStorage.removeItem('invoice-generator-data')

            await refreshSavedList()
            setShowMigrationModal(false)
            setLocalStorageData(null)
            showNotification(`ย้ายข้อมูล ${localStorageData.invoices.length} รายการเรียบร้อย`)
        } catch (error) {
            console.error('Error migrating data:', error)
            showNotification('เกิดข้อผิดพลาดในการย้ายข้อมูล')
        } finally {
            setIsMigrating(false)
        }
    }, [localStorageData, refreshSavedList, showNotification])

    // Skip migration and clear localStorage
    const skipMigration = useCallback(() => {
        localStorage.removeItem('invoice-generator-saved')
        localStorage.removeItem('invoice-generator-defaults')
        localStorage.removeItem('invoice-generator-data')
        setShowMigrationModal(false)
        setLocalStorageData(null)
    }, [])

    // Generate 50% deposit receipt from current invoice (before VAT)
    const generateDepositReceipt = useCallback(() => {
        // Calculate 50% of subtotal after discount (before VAT)
        const currentSubtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
        const currentDiscountAmount = invoice.discountType === 'percent'
            ? currentSubtotal * (invoice.discountRate / 100)
            : invoice.discountRate
        const afterDiscountAmount = currentSubtotal - currentDiscountAmount
        const depositAmount = afterDiscountAmount * 0.5

        // Create deposit receipt
        setCurrentSaveId(null)
        setInvoiceType('deposit_receipt')
        setInvoice(prev => ({
            ...prev,
            invoiceTitle: 'ใบเสร็จรับเงินมัดจำ',
            invoiceNumber: prev.invoiceNumber ? `DEP-${prev.invoiceNumber}` : '',
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            items: [{
                id: Date.now().toString(),
                description: `เงินมัดจำ 50% (จากยอด ${prev.currency}${afterDiscountAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ก่อน VAT)`,
                quantity: 1,
                rate: depositAmount,
            }],
            taxRate: 0,
            taxType: 'percent',
            discountRate: 0,
            discountType: 'percent',
            shipping: 0,
            notes: `อ้างอิงจากเอกสารเลขที่: ${prev.invoiceNumber || '-'}\nยอดรวมก่อน VAT: ${prev.currency}${afterDiscountAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}\nเงินมัดจำ 50%: ${prev.currency}${depositAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        }))
        showNotification('สร้างใบเสร็จมัดจำ 50% แล้ว')
    }, [invoice, showNotification])

    // Save current invoice (update existing or prompt for new)
    const saveInvoice = useCallback(async () => {
        if (currentSaveId) {
            // Update existing save
            setIsSaving(true)
            try {
                const res = await fetch(`/api/invoice-generator/${currentSaveId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: savedInvoices.find(s => s.id === currentSaveId)?.name,
                        type: invoiceType,
                        data: invoice,
                    }),
                })
                if (res.ok) {
                    await refreshSavedList()
                    showNotification('บันทึกแล้ว')
                } else {
                    showNotification('เกิดข้อผิดพลาด')
                }
            } catch (error) {
                console.error('Error saving invoice:', error)
                showNotification('เกิดข้อผิดพลาด')
            } finally {
                setIsSaving(false)
            }
        } else {
            // Open save as modal
            setNewSaveName(invoice.invoiceNumber || invoice.toName || 'เอกสารใหม่')
            setShowSaveAsModal(true)
        }
        setShowSaveDropdown(false)
    }, [currentSaveId, savedInvoices, invoice, invoiceType, showNotification, refreshSavedList])

    // Save as new invoice
    const saveAsNewInvoice = useCallback(async () => {
        const name = newSaveName.trim() || 'เอกสารใหม่'
        setIsSaving(true)
        try {
            const res = await fetch('/api/invoice-generator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    type: invoiceType,
                    data: invoice,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                setCurrentSaveId(data.invoice.id)
                await refreshSavedList()
                setShowSaveAsModal(false)
                setNewSaveName('')
                showNotification('บันทึกใหม่แล้ว')
            } else {
                showNotification('เกิดข้อผิดพลาด')
            }
        } catch (error) {
            console.error('Error saving new invoice:', error)
            showNotification('เกิดข้อผิดพลาด')
        } finally {
            setIsSaving(false)
        }
    }, [newSaveName, invoice, invoiceType, showNotification, refreshSavedList])

    // Load a saved invoice
    const loadSavedInvoice = useCallback(async (saved: SavedInvoice) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/invoice-generator/${saved.id}`)
            if (res.ok) {
                const data = await res.json()
                setInvoice(data.invoice.data)
                setInvoiceType(data.invoice.type || 'invoice')
                setCurrentSaveId(saved.id)
                setShowLoadDropdown(false)
                showNotification(`โหลด "${saved.name}" แล้ว`)
            } else {
                showNotification('เกิดข้อผิดพลาดในการโหลด')
            }
        } catch (error) {
            console.error('Error loading invoice:', error)
            showNotification('เกิดข้อผิดพลาดในการโหลด')
        } finally {
            setIsLoading(false)
        }
    }, [showNotification])

    // Delete a saved invoice
    const deleteSavedInvoice = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('ต้องการลบเอกสารที่บันทึกไว้นี้?')) return

        try {
            const res = await fetch(`/api/invoice-generator/${id}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                await refreshSavedList()
                if (currentSaveId === id) {
                    setCurrentSaveId(null)
                }
                showNotification('ลบแล้ว')
            } else {
                showNotification('เกิดข้อผิดพลาด')
            }
        } catch (error) {
            console.error('Error deleting invoice:', error)
            showNotification('เกิดข้อผิดพลาด')
        }
    }, [currentSaveId, showNotification, refreshSavedList])

    // Duplicate current invoice
    const duplicateInvoice = useCallback(() => {
        setCurrentSaveId(null)
        setNewSaveName(`${invoice.invoiceNumber || invoice.toName || 'เอกสาร'} (สำเนา)`)
        setShowSaveAsModal(true)
        setShowSaveDropdown(false)
    }, [invoice])

    // Save current "From" section as defaults
    const saveAsDefaults = useCallback(async () => {
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

            const res = await fetch('/api/invoice-generator/defaults', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaults }),
            })

            if (res.ok) {
                showNotification('บันทึกค่าเริ่มต้นแล้ว')
            } else {
                showNotification('เกิดข้อผิดพลาด')
            }
        } catch (error) {
            console.error('Error saving defaults:', error)
            showNotification('เกิดข้อผิดพลาด')
        }
        setShowSaveDropdown(false)
    }, [invoice, showNotification])

    // Reset form to clean state
    const resetForm = useCallback(async () => {
        setCurrentSaveId(null)
        setInvoiceType('invoice')
        try {
            const res = await fetch('/api/invoice-generator/defaults')
            if (res.ok) {
                const data = await res.json()
                if (data.defaults) {
                    setInvoice({
                        ...defaultInvoice,
                        ...data.defaults,
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

    const getTypeLabel = (type: InvoiceType) => {
        return invoiceTypes.find(t => t.value === type)?.label || type
    }

    const generatePDF = async () => {
        if (!invoiceRef.current) return
        setIsGenerating(true)

        try {
            const html2pdf = (await import('html2pdf.js')).default
            const element = invoiceRef.current
            const opt = {
                margin: 10,
                filename: `${invoice.invoiceTitle}-${invoice.invoiceNumber || 'draft'}.pdf`,
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

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-100">
            {/* Notice Toast */}
            {showNotice && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
                    {showNotice}
                </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
            )}

            {/* Migration Modal */}
            {showMigrationModal && localStorageData && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Upload className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-semibold text-zinc-800">พบข้อมูลเก่าในเครื่อง</h3>
                        </div>
                        <p className="text-zinc-600 mb-4">
                            พบข้อมูลที่บันทึกไว้ในเครื่อง (localStorage) ต้องการย้ายไปยัง MongoDB หรือไม่?
                        </p>
                        <div className="bg-zinc-50 rounded-lg p-3 mb-4 text-sm">
                            <p className="text-zinc-700">
                                <span className="font-medium">เอกสารที่บันทึก:</span> {localStorageData.invoices.length} รายการ
                            </p>
                            <p className="text-zinc-700">
                                <span className="font-medium">ค่าเริ่มต้น:</span> {localStorageData.defaults ? 'มี' : 'ไม่มี'}
                            </p>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={skipMigration}
                                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                                disabled={isMigrating}
                            >
                                ข้าม (ลบข้อมูลเก่า)
                            </button>
                            <button
                                onClick={migrateFromLocalStorage}
                                disabled={isMigrating}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
                            >
                                {isMigrating && <Loader2 className="w-4 h-4 animate-spin" />}
                                ย้ายข้อมูล
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save As Modal */}
            {showSaveAsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-800 mb-4">บันทึกเอกสาร</h3>
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
                                disabled={isSaving}
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={saveAsNewInvoice}
                                disabled={isSaving}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-2"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
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
                        <h1 className="text-lg font-semibold text-zinc-800">สร้างเอกสาร</h1>
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
                                title="โหลดเอกสาร"
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="hidden sm:inline">โหลด</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showLoadDropdown && (
                                <div className="absolute right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-30">
                                    {savedInvoices.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                                            ยังไม่มีเอกสารที่บันทึกไว้
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
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-zinc-800 truncate">
                                                                {saved.name}
                                                            </p>
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${saved.type === 'deposit_receipt'
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : saved.type === 'receipt'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : saved.type === 'quotation'
                                                                        ? 'bg-amber-100 text-amber-700'
                                                                        : 'bg-zinc-100 text-zinc-600'
                                                                }`}>
                                                                {getTypeLabel(saved.type)}
                                                            </span>
                                                        </div>
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
                                disabled={isSaving}
                                className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-zinc-100 font-medium rounded-lg transition-colors disabled:opacity-50"
                                title="บันทึก"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
                                            setNewSaveName(invoice.invoiceNumber || invoice.toName || 'เอกสารใหม่')
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
                                    <div className="border-t border-zinc-100 my-1" />
                                    <button
                                        onClick={() => {
                                            generateDepositReceipt()
                                            setShowSaveDropdown(false)
                                        }}
                                        disabled={subtotal <= 0}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Receipt className="w-4 h-4" />
                                        ออกใบมัดจำ 50% (ก่อน VAT)
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
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isGenerating ? 'กำลังสร้าง...' : 'ดาวน์โหลด PDF'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 lg:p-6">
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Form */}
                    <div className="space-y-4">
                        {/* Document Type & Title */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                                        ประเภทเอกสาร
                                    </label>
                                    <select
                                        value={invoiceType}
                                        onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    >
                                        {invoiceTypes.map((type) => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
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

                        {/* From Section */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-zinc-800">จาก (ผู้ออกเอกสาร)</h2>
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
                            <h2 className="text-sm font-semibold text-zinc-800 mb-3">รายละเอียดเอกสาร</h2>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">เลขที่เอกสาร</label>
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
                                    <label className="block text-xs text-zinc-500 mb-1">
                                        {invoiceType === 'receipt' || invoiceType === 'deposit_receipt'
                                            ? 'วันที่รับชำระ'
                                            : invoiceType === 'quotation'
                                                ? 'ใบเสนอราคาหมดอายุ'
                                                : 'กำหนดชำระ'}
                                    </label>
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
                                <span className="text-sm font-medium text-zinc-600">ตัวอย่างเอกสาร</span>
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
                                                    <span className="font-medium">
                                                        {invoiceType === 'receipt' || invoiceType === 'deposit_receipt'
                                                            ? 'วันที่รับชำระ:'
                                                            : invoiceType === 'quotation'
                                                                ? 'หมดอายุ:'
                                                                : 'กำหนดชำระ:'}
                                                    </span> {new Date(invoice.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                                                <span className="font-bold text-zinc-800">
                                                    {invoiceType === 'deposit_receipt'
                                                        ? 'ยอดเงินมัดจำ'
                                                        : invoiceType === 'quotation'
                                                            ? 'ยอดเสนอราคา'
                                                            : 'ยอดรวมสุทธิ'}
                                                </span>
                                                <span className="font-bold text-zinc-800 text-lg">{formatCurrency(total)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deposit Receipt Notice */}
                                    {invoiceType === 'deposit_receipt' && (
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                                            <p className="text-purple-800 text-sm font-medium">
                                                เอกสารนี้เป็นใบเสร็จรับเงินมัดจำ ยอดเงินดังกล่าวจะถูกหักจากค่าใช้จ่ายทั้งหมดเมื่อมีการชำระเงินครบถ้วน
                                            </p>
                                        </div>
                                    )}

                                    {/* Quotation Notice */}
                                    {invoiceType === 'quotation' && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                            <p className="text-amber-800 text-sm font-medium">
                                                ใบเสนอราคานี้มีผลตามระยะเวลาที่กำหนด ราคาอาจมีการเปลี่ยนแปลงหลังจากวันหมดอายุ
                                            </p>
                                        </div>
                                    )}

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
