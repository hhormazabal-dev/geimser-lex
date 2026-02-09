'use client';

import { Check, Zap, Building2, ShieldCheck, Scale } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from './Reveal';

const plans = [
    {
        name: 'Plan Inicial',
        cases: 'Hasta 50 casos',
        description: 'Ideal para abogados independientes que buscan ordenar su práctica y automatizar plazos.',
        price: 'Consultar',
        features: [
            'Gestión de hasta 50 causas activas',
            'Alertas de plazos vía email',
            'Gestor documental básico',
            'Acceso móvil',
            'Soporte por ticket 24/48hrs'
        ],
        cta: 'Cotizar Inicial',
        highlighted: false,
        icon: Scale,
        color: 'blue'
    },
    {
        name: 'Plan Intermedio',
        cases: 'Hasta 100 casos',
        description: 'Para estudios en crecimiento que necesitan control total y reportes avanzados.',
        price: 'Consultar',
        features: [
            'Todo lo del Plan Inicial',
            'Gestión de hasta 100 causas activas',
            'Portal de Clientes (Marca Blanca)',
            'Reportes de Inteligencia de Negocios',
            'Facturación y Control de Horas',
            'Soporte Prioritario WhatsApp'
        ],
        cta: 'Cotizar Intermedio',
        highlighted: true,
        icon: Zap,
        color: 'indigo'
    },
    {
        name: 'Plan Corporativo',
        cases: 'Illimitados',
        description: 'Infraestructura dedicada para grandes firmas y departamentos legales.',
        price: 'A Medida',
        features: [
            'Todo lo del Plan Intermedio',
            'Causas y Usuarios Ilimitados',
            'API & Integraciones a medida',
            'Auditoría y Compliance ISO 27001',
            'Onboarding y Capacitación presencial',
            'SLA de 99.9% garantizado'
        ],
        cta: 'Contactar Ventas',
        highlighted: false,
        icon: Building2,
        color: 'slate'
    }
];

export function Pricing() {
    return (
        <section id="precios" className="py-24 lg:py-32 bg-slate-50 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />

            <div className="container mx-auto px-6 lg:px-12 max-w-7xl relative z-10">
                <Reveal>
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <span className="inline-block text-blue-800 font-bold uppercase tracking-widest text-xs mb-4">
                            Inversión Inteligente
                        </span>
                        <h2 className="font-serif text-4xl lg:text-5xl text-slate-900 mb-6">
                            Escala tu firma al <span className="text-blue-900">siguiente nivel</span>
                        </h2>
                        <p className="text-lg text-slate-600">
                            Elige el plan que se adapte a tu etapa actual. Todos incluyen actualizaciones gratuitas y seguridad de nivel bancario.
                        </p>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-3 gap-8 items-start">
                    {plans.map((plan, index) => {
                        const Icon = plan.icon;
                        return (
                            <Reveal key={plan.name} delay={index * 0.1}>
                                <div
                                    className={`relative p-8 rounded-2xl transition-all duration-300 ${plan.highlighted
                                            ? 'bg-blue-900 text-white shadow-2xl scale-105 border border-blue-700 z-10'
                                            : 'bg-white text-slate-900 border border-slate-200 hover:shadow-xl hover:border-blue-200'
                                        }`}
                                >
                                    {plan.highlighted && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-400 to-cyan-400 text-blue-900 text-xs font-bold uppercase tracking-widest py-1 px-4 rounded-full shadow-lg">
                                            Más Popular
                                        </div>
                                    )}

                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${plan.highlighted ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-800'
                                        }`}>
                                        <Icon className="w-6 h-6" />
                                    </div>

                                    <h3 className="text-2xl font-bold font-serif mb-2">{plan.name}</h3>
                                    <div className={`text-sm font-bold uppercase tracking-wider mb-4 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600'
                                        }`}>
                                        {plan.cases}
                                    </div>
                                    <p className={`mb-8 leading-relaxed ${plan.highlighted ? 'text-blue-100' : 'text-slate-500'
                                        }`}>
                                        {plan.description}
                                    </p>

                                    <div className="space-y-4 mb-8">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <Check className={`w-5 h-5 shrink-0 ${plan.highlighted ? 'text-blue-400' : 'text-blue-600'
                                                    }`} />
                                                <span className={`text-sm ${plan.highlighted ? 'text-slate-200' : 'text-slate-600'
                                                    }`}>
                                                    {feature}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <Link
                                        href="#contacto"
                                        className={`block w-full py-4 rounded-xl text-center font-bold tracking-wide transition-all duration-300 ${plan.highlighted
                                                ? 'bg-white text-blue-900 hover:bg-blue-50 shadow-lg shadow-blue-900/50'
                                                : 'bg-slate-100 text-slate-900 hover:bg-blue-50 hover:text-blue-800'
                                            }`}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            </Reveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
