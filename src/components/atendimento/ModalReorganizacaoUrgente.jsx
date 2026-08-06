import React from 'react';

const ModalReorganizacaoUrgente = ({ isOpen, onClose, bumpData, onConfirmed }) => {
  if (!isOpen || !bumpData) return null;

  const { lastNormalPerson, sessionName, eventDate } = bumpData;

  const handleConfirm = () => {
    onConfirmed(`Encaixe urgente realizado! A pessoa ${lastNormalPerson.atendimento_pessoas?.nome || ''} foi reagendada para a próxima sessão.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center font-bold text-lg">
            <span className="material-symbols-outlined text-xl">priority_high</span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-lg text-primary">Aviso de Remanejamento</h3>
            <p className="text-xs text-gray-500">A sessão selecionada ({sessionName}) já atingiu o limite de vagas.</p>
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200/60 text-xs text-amber-950 space-y-2">
          <p>
            A pessoa <strong>{lastNormalPerson.atendimento_pessoas?.nome || 'Pessoa sem nome'}</strong> será desencaixada desta sessão e retornará à 1ª posição da fila de espera para ser programada na próxima data disponível.
          </p>
          <p className="font-semibold text-amber-900">
            Deseja confirmar o encaixe urgente e a reorganização da fila?
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/20 hover:bg-amber-700 active:scale-95 transition-all"
          >
            Confirmar Encaixe
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalReorganizacaoUrgente;
