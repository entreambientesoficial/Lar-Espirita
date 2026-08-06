import React from 'react';

const ModalReorganizacaoUrgente = ({ isOpen, onClose, onConfirm, sessionInfo, lastNormalPerson }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl">warning</span>
        </div>

        <div className="space-y-2">
          <h4 className="font-headline font-bold text-lg text-primary">Sessão com Capacidade Preenchida</h4>
          <p className="text-xs text-gray-500 leading-relaxed font-medium">
            Esta sessão já atingiu o limite de atendimentos configurado ({sessionInfo?.capacity || 6} vagas).
          </p>
        </div>

        {lastNormalPerson && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
            <span className="font-bold block uppercase tracking-wider text-[10px] text-amber-700">Remanejamento Previsto:</span>
            <p className="font-medium">
              O paciente <strong>{lastNormalPerson.atendimento_pessoas?.nome || 'Paciente sem nome'}</strong> será desencaixado desta sessão e retornará à 1ª posição da fila de espera para ser programado na próxima data disponível.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 font-medium">
          Deseja inserir este atendimento urgente e reorganizar as próximas programações?
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/20 hover:bg-amber-700 active:scale-95 transition-all"
          >
            Inserir e Reorganizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalReorganizacaoUrgente;
