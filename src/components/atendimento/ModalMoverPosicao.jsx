import React, { useState } from 'react';

const ModalMoverPosicao = ({ isOpen, onClose, person, maxPosition, onMoved }) => {
  const [targetPos, setTargetPos] = useState(person?.posicao_fila || 1);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !person) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const posNum = parseInt(targetPos, 10);
    if (isNaN(posNum) || posNum < 1) return;

    setLoading(true);
    await onMoved(person.id, posNum);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 max-w-xs w-full space-y-5 border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h4 className="font-headline font-bold text-base text-primary">Alterar Posição na Fila</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <p className="text-xs text-gray-500 font-medium">
          Mover <strong>{person.nome}</strong> (posição atual: #{person.posicao_fila}) para:
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Nova Posição (1 a {maxPosition})
            </label>
            <input
              type="number"
              min="1"
              max={maxPosition}
              value={targetPos}
              onChange={e => setTargetPos(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-base font-bold text-primary text-center"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Movendo...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalMoverPosicao;
