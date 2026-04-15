import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { dataService, supabase } from '../lib/supabase';
import { CHECKIN_TOKEN } from '../lib/checkinToken';

const Checkin = () => {
  const { profile } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const qrRegionId = "reader";

  useEffect(() => {
    const fetchTodayActivity = async () => {
      if (profile) {
        const data = await dataService.getTodayActivity(profile.id);
        setActivity(data);
      }
    };
    fetchTodayActivity();
  }, [profile]);

  useEffect(() => {
    if (isScanning && !isVerified) {
      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleSuccess(decodedText);
        },
        () => {}
      ).catch(err => {
        console.error("Erro ao iniciar câmera:", err);
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
        setIsScanning(false);
      });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Erro ao parar scanner:", err));
      }
    };
  }, [isScanning, isVerified]);

  const handleSuccess = async (_text) => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
    }

    if (!profile || !activity) {
      setError("Nenhuma atividade programada para hoje. Presença não registrada.");
      setIsScanning(false);
      return;
    }

    // Valida o token do QR Code da Casa
    if (_text !== CHECKIN_TOKEN) {
      setError("QR Code inválido. Aponte para o QR Code oficial da Casa.");
      setIsScanning(false);
      return;
    }

    // Se já confirmou pela Agenda: apenas marca qr_checkin = true
    if (activity.presenca_id) {
      await supabase
        .from('presencas')
        .update({ qr_checkin: true })
        .eq('id', activity.presenca_id);
      setIsVerified(true);
      setIsScanning(false);
      return;
    }

    // Sem confirmação prévia: insere novo registro já com qr_checkin = true
    const { error } = await supabase
      .from('presencas')
      .insert([{ user_id: profile.id, atividade_id: activity.id, qr_checkin: true }]);
    if (!error) {
      setIsVerified(true);
      setIsScanning(false);
    } else {
      setError("Erro ao registrar presença. Tente novamente.");
      setIsScanning(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-6 py-8 space-y-8 font-body">
      {/* Hero Section: Active Activity */}
      <section className="relative overflow-hidden bg-white rounded-2xl p-6 space-y-4 shadow-sm border border-gray-100">
        <div className="absolute -right-12 -top-12 opacity-[0.03] text-primary">
          <span className="material-symbols-outlined text-[12rem]">qr_code_2</span>
        </div>
        <div className="space-y-1">
          <span className="text-secondary font-bold tracking-widest text-[10px] uppercase">Trabalho Atual</span>
          <h1 className="text-3xl font-extrabold text-primary leading-tight font-headline">
            {activity?.name || 'Carregando...'}
          </h1>
          <p className="text-on-surface-variant text-sm font-medium">{activity?.time_range || '--:--'}</p>
        </div>
      </section>

      {/* Main Scanner Area */}
      {!isVerified ? (
        <section className="space-y-6">
          <div className="relative aspect-square w-full bg-black rounded-3xl overflow-hidden shadow-2xl">
            {isScanning ? (
              <>
                <div id={qrRegionId} className="w-full h-full"></div>
                <div className="scanner-viewfinder">
                  <div className="scanner-laser"></div>
                  <div className="scanner-corner top-0 left-0 border-t-4 border-l-4"></div>
                  <div className="scanner-corner top-0 right-0 border-t-4 border-r-4"></div>
                  <div className="scanner-corner bottom-0 left-0 border-b-4 border-l-4"></div>
                  <div className="scanner-corner bottom-0 right-0 border-b-4 border-r-4"></div>
                </div>
                <button 
                  onClick={() => setIsScanning(false)}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-white/20 backdrop-blur-md text-white px-6 py-2 rounded-full text-xs font-bold"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-6 bg-gradient-to-b from-gray-900 to-black">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center text-primary animate-pulse">
                  <span className="material-symbols-outlined text-4xl">photo_camera</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">Pronto para o Check-in?</h3>
                  <p className="text-white/60 text-sm">Aponte a câmera para o QR Code da Casa para confirmar sua presença.</p>
                </div>
                {error && <p className="text-red-400 text-xs font-medium bg-red-400/10 p-2 rounded-lg">{error}</p>}
                
                <button 
                  onClick={() => setIsScanning(true)}
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Iniciar Scanner
                </button>

                <button 
                  onClick={() => handleSuccess("simulated-code")}
                  className="text-white/30 text-[10px] uppercase tracking-widest hover:text-white/60 transition-colors"
                >
                  Simular Leitura (Modo Teste)
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-3 px-2">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              O check-in será gravado permanentemente em sua ficha de voluntariado e na escala de {activity?.name || 'hoje'}.
            </p>
          </div>
        </section>
      ) : (
        /* Success State Section */
        <section className="bg-white rounded-3xl p-8 space-y-8 relative overflow-hidden border border-green-100 shadow-xl shadow-green-900/5 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-primary leading-tight font-headline">Check-in Realizado!</h2>
              <p className="text-on-surface-variant font-medium">Bom trabalho no {activity?.name} de hoje, {profile?.name?.split(' ')[0]}.</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center space-y-3 shadow-inner">
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400">Token Digital</span>
            <span className="text-2xl font-mono font-bold text-primary tracking-wider uppercase">
              {activity?.id ? activity.id.slice(0, 8) : '2026-PRES'}
            </span>
            <div className="h-[1px] w-full bg-gray-200"></div>
            <p className="text-center text-[10px] text-on-surface-variant italic opacity-60">
              Presença registrada em {new Date().toLocaleString('pt-BR')}.
            </p>
          </div>

          <button 
            onClick={() => setIsVerified(false)}
            className="w-full py-4 bg-gray-100 text-on-surface-variant font-bold rounded-xl hover:bg-gray-200 transition-all"
          >
            Voltar ao Início
          </button>
        </section>
      )}
    </main>
  );
};

export default Checkin;
