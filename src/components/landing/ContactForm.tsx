'use client';

import { useState } from 'react';
import { z } from 'zod';

const contactSchema = z.object({
    name: z.string().min(2, 'Nombre muy corto'),
    email: z.string().email('Email inválido'),
    phone: z.string().optional(),
    message: z.string().min(10, 'Mensaje muy corto'),
});

type FormData = z.infer<typeof contactSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

export function ContactForm() {
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
        message: '',
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormData]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrors({});

        try {
            const validatedData = contactSchema.parse(formData);

            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validatedData),
            });

            const result = await response.json();

            if (result.success) {
                setStatus('success');
                setFormData({ name: '', email: '', phone: '', message: '' });
            } else {
                setStatus('error');
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                const fieldErrors: FormErrors = {};
                error.errors.forEach(err => {
                    if (err.path[0]) {
                        fieldErrors[err.path[0] as keyof FormData] = err.message;
                    }
                });
                setErrors(fieldErrors);
                setStatus('idle');
            } else {
                setStatus('error');
            }
        }
    };

    if (status === 'success') {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Mensaje enviado!</h3>
                <p className="text-slate-600 mb-6">Nos pondremos en contacto contigo pronto.</p>
                <button
                    onClick={() => setStatus('idle')}
                    className="text-blue-800 font-semibold hover:text-blue-600 transition-colors"
                >
                    Enviar otro mensaje
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre completo *
                </label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400`}
                    placeholder="Ej: María González"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                    Correo electrónico *
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400`}
                    placeholder="Ej: maria@estudio.cl"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Teléfono */}
            <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-2">
                    Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
                    placeholder="Ej: +56 9 1234 5678"
                />
            </div>

            {/* Mensaje */}
            <div>
                <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-2">
                    ¿En qué podemos ayudarte? *
                </label>
                <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl border ${errors.message ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none placeholder:text-slate-400`}
                    placeholder="Cuéntanos sobre tu firma, tus desafíos actuales y qué esperas lograr..."
                />
                {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
            </div>

            {/* Error general */}
            {status === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    Hubo un error al enviar tu mensaje. Por favor intenta nuevamente.
                </div>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-4 px-6 bg-blue-900 text-white font-bold text-sm uppercase tracking-widest rounded-xl hover:bg-blue-800 focus:ring-4 focus:ring-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
                {status === 'loading' ? (
                    <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enviando...
                    </>
                ) : (
                    'Enviar Mensaje'
                )}
            </button>

            <p className="text-xs text-center text-slate-500">
                Al enviar, aceptas que nos comuniquemos contigo respecto a tu consulta.
            </p>
        </form>
    );
}
