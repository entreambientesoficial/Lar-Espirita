import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { dataService, calculateHaversineDistance } from '../lib/supabase';
import { CHECKIN_TOKEN } from '../lib/checkinToken';

const Checkin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [activity, setActivity] = useState(null);
  const [casaConfig, setCasaConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados de Fluxo de Check-in
  const [isVerified, setIsVerified] = useState(false);
  const [checkinTimeStr, setCheckinTimeStr] = useState('');
  const [checkinDistance, setCheckinDistance] = useState(null);
  
  // Modos: 'geo' (Geolocalização principal) ou 'qrcode' (Fallback alternativo)
  const [checkinMode, setCheckinMode] = useState('geo');

  // Estados do Check-in por GPS
  const [geoStatus, setGeoStatus] = useState('idle'); // 'idle' | 'locating' | 'refining' | 'submitting' | 'error'
  const [geoMessage, setGeoMessage] = useState('');
  const [geoErrorType, setGeoErrorType] = useState(null); // 'permission' | 'outside' | 'window' | 'no_confirmation' | 'unavailable' | 'rpc_error'
  const [approxDistance, setApproxDistance] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // Estados do Scanner QR Code (Fallback)
  const [isScanning, setIsScanning] = useState(false);
  const [qrError, setQrError] = useState(null);
  const scannerRef = useRef(null);
  const qrRegionId = "reader";

  useEffect(() => {
    const fetchInitial = async () => {
      if (!profile) return;
      setLoading(true);

      const [actData, cfgData] = await Promise.all([
        dataService.getTodayActivity(profile.id),
        dataService.getCasaConfig()
      ]);

      setActivity(actData);
      setCasaConfig(cfgData);

      if (actData?.qr_checkin) {
        setIsVerified(true);
      }

      setLoading(false);
    };

    fetchInitial();
  }, [profile]);

  // Efeito para Scanner QR Code quando no modo fallback
  useEffect(() => {
    if (checkinMode === 'qrcode' && isScanning && !isVerified) {
      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleQrSuccess(decodedText);
        },
        () => {}
      ).catch(err => {
        console.error("Erro ao iniciar câmera para QR Code:", err);
        setQrError("Não foi possível acessar a câmera. Verifique as permissões do dispositivo.");
        setIsScanning(false);
      });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Erro ao parar scanner:", err));
      }
    };
  }, [checkinMode, isScanning, isVerified]);

  /**
   * Executa a captura de geolocalização do dispositivo com refinamento de precisão
   */
  const handleDoGeoCheckin = async () => {
    if (!profile || !activity) {
      setGeoStatus('error');
      setGeoErrorType('no_confirmation');
      setGeoMessage("Você precisa primeiro confirmar sua presença nesta atividade na Agenda antes de realizar o check-in.");
      return;
    }

    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoErrorType('unavailable');
      setGeoMessage("Não foi possível confirmar sua localização. Geolocalização não é suportada por este dispositivo.");
      return;
    }

    setGeoStatus('locating');
    setGeoMessage("Obtendo localização do dispositivo...");
    setGeoErrorType(null);
    setApproxDistance(null);

    const getPositionPromise = (options) => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    };

    try {
      // 1ª tentativa de captura com alta precisão
      let pos = await getPositionPromise({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

      // Se a precisão obtida for baixa (> 50m), faz uma 2ª tentativa de refinamento
      if (pos.coords.accuracy > 50) {
        setGeoStatus('refining');
        setGeoMessage("Estamos tentando obter uma localização mais precisa...");
        setGpsAccuracy(Math.round(pos.coords.accuracy));

        await new Promise(r => setTimeout(r, 2000));

        try {
          const secondPos = await getPositionPromise({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
          if (secondPos.coords.accuracy < pos.coords.accuracy) {
            pos = secondPos;
          }
        } catch (e) {
          // Mantém a primeira posição se a segunda falhar
        }
      }

      const { latitude, longitude, accuracy } = pos.coords;
      setGpsAccuracy(Math.round(accuracy));

      // Cálculo de distância local para feedback imediato se necessário
      if (casaConfig?.latitude != null && casaConfig?.longitude != null) {
        const dist = calculateHaversineDistance(latitude, longitude, casaConfig.latitude, casaConfig.longitude);
        setApproxDistance(dist);
      }

      setGeoStatus('submitting');
      setGeoMessage("Validando presença no servidor...");

      // Chamada OBRIGATÓRIA à RPC server-side no Supabase (Sem fallback client-side)
      const res = await dataService.realizarCheckin({
        atividadeId: activity.id,
        method: 'geolocation',
        lat: latitude,
        lng: longitude,
        accuracy: Math.round(accuracy)
      });

      if (res.success) {
        setIsVerified(true);
        setGeoStatus('idle');
        setCheckinTimeStr(res.checkin_at || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setCheckinDistance(res.distance_meters !== undefined ? res.distance_meters : approxDistance);
      } else {
        setGeoStatus('error');

        if (res.no_confirmation) {
          setGeoErrorType('no_confirmation');
          setGeoMessage("Você precisa primeiro confirmar sua presença nesta atividade na Agenda antes de realizar o check-in.");
        } else if (res.outside_radius) {
          setGeoErrorType('outside');
          setGeoMessage("Você precisa estar próximo à Casa para realizar o check-in.");
          if (res.distance_meters != null) {
            setApproxDistance(res.distance_meters);
          }
        } else if (res.outside_window) {
          setGeoErrorType('window');
          setGeoMessage(res.message || "Fora da janela de horário permitida para check-in (30 min antes até 30 min depois do início).");
        } else if (res.already_done) {
          setIsVerified(true);
          setGeoStatus('idle');
        } else if (res.rpcError) {
          setGeoErrorType('rpc_error');
          setGeoMessage(res.message);
        } else {
          setGeoErrorType('unavailable');
          setGeoMessage(res.message || "Não foi possível confirmar seu check-in por geolocalização.");
        }
      }
    } catch (err) {
      console.error("Erro no GPS:", err);
      setGeoStatus('error');

      if (err.code === err.PERMISSION_DENIED) {
        setGeoErrorType('permission');
        setGeoMessage("Para confirmar sua presença automaticamente, permita o acesso à localização do dispositivo.");
      } else {
        setGeoErrorType('unavailable');
        setGeoMessage("Não foi possível confirmar sua localização.");
      }
    }
  };

  /**
   * Executa a confirmação via QR Code Fallback (chamando também a RPC server-side)
   */
  const handleQrSuccess = async (textCode) => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
    }

    if (!profile || !activity) {
      setQrError("Nenhuma atividade confirmada para hoje. Presença não registrada.");
      setIsScanning(false);
      return;
    }

    if (textCode !== CHECKIN_TOKEN) {
      setQrError("QR Code inválido. Aponte para o QR Code oficial da Casa.");
      setIsScanning(false);
      return;
    }

    // Executa check-in via RPC com p_method = 'qrcode'
    const res = await dataService.realizarCheckin({
      atividadeId: activity.id,
      method: 'qrcode'
    });

    if (res.success || res.already_done) {
      setIsVerified(true);
      setIsScanning(false);
      setCheckinTimeStr(res.checkin_at || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setQrError(res.message || "Erro ao registrar presença por QR Code.");
      setIsScanning(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-6 py-12 text-center font-body text-gray-400 italic">
        Carregando informações do trabalho...
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8 space-y-8 font-body">
      {/* Target Activity Card */}
      <section className="relative overflow-hidden bg-white rounded-3xl p-6 space-y-3 shadow-sm border border-gray-100">
        <div className="absolute -right-10 -top-10 opacity-[0.04] text-primary">
          <span className="material-symbols-outlined text-[10rem]">
            {checkinMode === 'geo' ? 'location_on' : 'qr_code_2'}
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-secondary font-bold tracking-widest text-[10px] uppercase">Seu Trabalho Hoje</span>
          <h1 className="text-2xl font-extrabold text-primary leading-tight font-headline">
            {activity?.name || 'Apometria'}
          </h1>
          <p className="text-on-surface-variant text-xs font-medium">
            {activity?.start_time && activity?.end_time 
              ? `${activity.start_time.slice(0, 5)} - ${activity.end_time.slice(0, 5)}`
              : (activity?.time_range || 'Horário de atendimento')}
          </p>
        </div>
      </section>

      {/* Main Check-in Flow */}
      {!isVerified ? (
        <section className="space-y-6">
          {checkinMode === 'geo' ? (
            /* Mode: Geolocation Check-in (PRIMARY) */
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-primary/5 space-y-6 text-center animate-in fade-in">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto shadow-inner relative">
                <span className="material-symbols-outlined text-4xl animate-bounce">location_on</span>
                {geoStatus === 'locating' || geoStatus === 'refining' || geoStatus === 'submitting' ? (
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                ) : null}
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-primary font-headline">
                  Check-in por Geolocalização
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed px-2">
                  Ao clicar em <strong>Fazer Check-in</strong>, o sistema verificará se o seu dispositivo está próximo ao endereço da Casa.
                </p>
              </div>

              {/* Status Message / Errors */}
              {(geoStatus === 'locating' || geoStatus === 'refining' || geoStatus === 'submitting') && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs font-bold text-primary animate-pulse flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">my_location</span>
                  {geoMessage}
                </div>
              )}

              {geoStatus === 'error' && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-left space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
                    <span className="material-symbols-outlined text-base">error_outline</span>
                    <span>Não foi possível fazer o check-in</span>
                  </div>
                  <p className="text-xs text-red-800 leading-relaxed font-medium">{geoMessage}</p>

                  {/* Exibe distância aproximada discretamente se estiver fora do raio */}
                  {geoErrorType === 'outside' && approxDistance != null && (
                    <div className="pt-2 border-t border-red-100 flex justify-between items-center text-[11px] font-bold text-red-900">
                      <span>Distância aproximada da Casa:</span>
                      <span className="font-mono bg-red-100 px-2 py-0.5 rounded text-red-800">{approxDistance} m</span>
                    </div>
                  )}

                  {/* Informação de precisão obtida */}
                  {gpsAccuracy != null && gpsAccuracy > 50 && (
                    <p className="text-[10px] text-red-600 italic pt-1">
                      Precisão atual do GPS do celular: ±{gpsAccuracy} metros.
                    </p>
                  )}
                </div>
              )}

              {/* Botão Principal de Check-in */}
              <button
                onClick={handleDoGeoCheckin}
                disabled={geoStatus === 'locating' || geoStatus === 'refining' || geoStatus === 'submitting'}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base"
              >
                <span className="material-symbols-outlined text-xl">where_to_vote</span>
                {geoStatus === 'locating' || geoStatus === 'refining' || geoStatus === 'submitting' 
                  ? 'Verificando...' 
                  : geoStatus === 'error' 
                  ? 'Tentar Novamente' 
                  : 'Fazer Check-in'}
              </button>

              {/* Ação Alternativa para Ir para Agenda se sem confirmação prévia */}
              {geoErrorType === 'no_confirmation' && (
                <button
                  type="button"
                  onClick={() => navigate('/agenda')}
                  className="w-full py-3 bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-700/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">calendar_month</span>
                  Ir para a Agenda e Confirmar Presença
                </button>
              )}

              {/* Link discreto para QR Code Fallback */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckinMode('qrcode');
                    setIsScanning(true);
                    setQrError(null);
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-primary transition-colors flex items-center justify-center gap-1.5 mx-auto underline underline-offset-4"
                >
                  <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                  Usar QR Code (Método Alternativo)
                </button>
              </div>
            </div>
          ) : (
            /* Mode: QR Code Scanner Fallback */
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Método Fallback</span>
                <button
                  onClick={() => setCheckinMode('geo')}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Voltar para Geolocalização
                </button>
              </div>

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
                      <h3 className="text-white font-bold text-xl mb-2">Check-in por QR Code</h3>
                      <p className="text-white/60 text-sm">Aponte a câmera para o QR Code impresso da Casa para confirmar sua presença.</p>
                    </div>
                    {qrError && <p className="text-red-400 text-xs font-medium bg-red-400/10 p-3 rounded-lg leading-relaxed">{qrError}</p>}
                    
                    <button 
                      onClick={() => setIsScanning(true)}
                      className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Iniciar Scanner
                    </button>

                    <button 
                      onClick={() => handleQrSuccess(CHECKIN_TOKEN)}
                      className="text-white/30 text-[10px] uppercase tracking-widest hover:text-white/60 transition-colors"
                    >
                      Simular Leitura (Modo Teste)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 px-2">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              O check-in será registrado permanentemente em sua ficha de presença na escala de {activity?.name || 'hoje'}.
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
              <h2 className="text-2xl font-extrabold text-primary leading-tight font-headline">Presença Confirmada!</h2>
              <p className="text-on-surface-variant font-medium text-sm mt-1">
                Bom trabalho no {activity?.name || 'atendimento'} de hoje, {profile?.name?.split(' ')[0]}.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center space-y-3 shadow-inner">
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400">Comprovante de Check-in</span>
            <span className="text-xl font-mono font-bold text-primary tracking-wider uppercase">
              {checkinTimeStr ? `Check-in às ${checkinTimeStr}` : 'Presença Registrada'}
            </span>
            {checkinDistance != null && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Confirmado no local ({checkinDistance}m da Casa)
              </span>
            )}
            <div className="h-[1px] w-full bg-gray-200 my-1"></div>
            <p className="text-center text-[10px] text-on-surface-variant italic opacity-60">
              Registrado em {new Date().toLocaleDateString('pt-BR')} via {checkinMode === 'geo' ? 'Geolocalização GPS' : 'QR Code'}.
            </p>
          </div>

          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            Voltar ao Início
          </button>
        </section>
      )}
    </main>
  );
};

export default Checkin;
