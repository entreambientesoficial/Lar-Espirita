import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const ModalCadastroPessoa = ({ isOpen, onClose, editingPerson = null, onSaved }) => {
  const { profile } = useAuth();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split('T')[0]);
  const [tipoAtendimento, setTipoAtendimento] = useState('Apometria');
  const [prioridade, setPrioridade] = useState('Normal');
  const [motivoUrgencia, setMotivoUrgencia] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [placeAsPriority, setPlaceAsPriority] = useState(false);

  // Campos de Disponibilidade (Opcionais)
  const [diasDisponiveis, setDiasDisponiveis] = useState([1, 2, 3, 4, 5, 6]); // Padrão todos os dias
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState(['tarde', 'noite']); // Padrão tarde e noite
  const [datasIndisponiveisText, setDatasIndisponiveisText] = useState('');
  const [observacoesDisponibilidade, setObservacoesDisponibilidade] = useState('');

  // Estados para a Programação Imediata (Opcional) de Urgências
  const [atividades, setAtividades] = useState([]);
  const [dataProgramacao, setDataProgramacao] = useState('');
  const [sessaoId, setSessaoId] = useState('');
  const [forceOverCapacity, setForceOverCapacity] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAtividades();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingPerson) {
      setNome(editingPerson.nome || '');
      setTelefone(editingPerson.telefone || '');
      setDataEntrada(editingPerson.data_entrada || new Date().toISOString().split('T')[0]);
      setTipoAtendimento(editingPerson.tipo_atendimento || 'Apometria');
      setPrioridade(editingPerson.prioridade || 'Normal');
      setMotivoUrgencia(editingPerson.motivo_urgencia || '');
      setObservacoes(editingPerson.observacoes || '');
      setPlaceAsPriority(false);

      // Disponibilidade
      setDiasDisponiveis(Array.isArray(editingPerson.dias_disponiveis) ? editingPerson.dias_disponiveis : [1, 2, 3, 4, 5, 6]);
      setPeriodosDisponiveis(Array.isArray(editingPerson.periodos_disponiveis) ? editingPerson.periodos_disponiveis : ['tarde', 'noite']);
      setDatasIndisponiveisText(Array.isArray(editingPerson.datas_indisponiveis) ? editingPerson.datas_indisponiveis.join(', ') : '');
      setObservacoesDisponibilidade(editingPerson.observacoes_disponibilidade || '');

      setDataProgramacao('');
      setSessaoId('');
      setForceOverCapacity(false);
    } else {
      resetForm();
    }
  }, [editingPerson, isOpen]);

  const loadAtividades = async () => {
    try {
      const { data } = await supabase
        .from('atividades')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      setAtividades(data || []);
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
    }
  };

  const resetForm = () => {
    setNome('');
    setTelefone('');
    setDataEntrada(new Date().toISOString().split('T')[0]);
    setTipoAtendimento('Apometria');
    setPrioridade('Normal');
    setMotivoUrgencia('');
    setObservacoes('');
    setPlaceAsPriority(false);

    setDiasDisponiveis([1, 2, 3, 4, 5, 6]);
    setPeriodosDisponiveis(['tarde', 'noite']);
    setDatasIndisponiveisText('');
    setObservacoesDisponibilidade('');

    setDataProgramacao('');
    setSessaoId('');
    setForceOverCapacity(false);
    setErrorMsg('');
  };

  const toggleDay = (dayNum) => {
    if (diasDisponiveis.includes(dayNum)) {
      setDiasDisponiveis(diasDisponiveis.filter(d => d !== dayNum));
    } else {
      setDiasDisponiveis([...diasDisponiveis, dayNum]);
    }
  };

  const togglePeriod = (periodStr) => {
    if (periodosDisponiveis.includes(periodStr)) {
      setPeriodosDisponiveis(periodosDisponiveis.filter(p => p !== periodStr));
    } else {
      setPeriodosDisponiveis([...periodosDisponiveis, periodStr]);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErrorMsg('Por favor, informe o nome completo.');
      return;
    }

    if (prioridade === 'Urgente' && !motivoUrgencia.trim()) {
      setErrorMsg('Para atendimentos urgentes, o motivo da urgência é obrigatório.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const parsedDatasIndisponiveis = datasIndisponiveisText
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));

    const payloadDisponibilidade = {
      dias_disponiveis: diasDisponiveis,
      periodos_disponiveis: periodosDisponiveis,
      datas_indisponiveis: parsedDatasIndisponiveis.length > 0 ? parsedDatasIndisponiveis : null,
      observacoes_disponibilidade: observacoesDisponibilidade.trim() || null,
    };

    try {
      if (editingPerson) {
        await atendimentoService.updatePessoa(
          editingPerson.id,
          {
            nome: nome.trim(),
            telefone: telefone.trim() || null,
            data_entrada: dataEntrada,
            tipo_atendimento: tipoAtendimento,
            prioridade,
            motivo_urgencia: prioridade === 'Urgente' ? motivoUrgencia.trim() : null,
            observacoes: observacoes.trim() || null,
            ...payloadDisponibilidade,
          }
        );
        onSaved('Pessoa atualizada com sucesso!');
      } else if (prioridade === 'Urgente' && dataProgramacao && sessaoId) {
        const selectedAtividade = atividades.find(a => a.id === sessaoId);
        if (!selectedAtividade) {
          setErrorMsg('Selecione uma sessão válida para a programação imediata.');
          setLoading(false);
          return;
        }

        await atendimentoService.createAndProgramUrgente({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          tipo_atendimento: tipoAtendimento,
          motivo_urgencia: motivoUrgencia.trim(),
          observacoes: observacoes.trim() || null,
          data_entrada: dataEntrada,
          atividadeId: sessaoId,
          eventDate: dataProgramacao,
          startTime: selectedAtividade.start_time,
          endTime: selectedAtividade.end_time,
          forceOverCapacity,
          ...payloadDisponibilidade,
        });

        onSaved('Pessoa cadastrada e programada com sucesso para a sessão escolhida!');
      } else {
        await atendimentoService.createPessoa(
          {
            nome: nome.trim(),
            telefone: telefone.trim() || null,
            data_entrada: dataEntrada,
            tipo_atendimento: tipoAtendimento,
            prioridade,
            motivo_urgencia: prioridade === 'Urgente' ? motivoUrgencia.trim() : null,
            observacoes: observacoes.trim() || null,
            ...payloadDisponibilidade,
          },
          { placeAsPriority }
        );
        onSaved('Pessoa cadastrada na fila com sucesso!');
      }
      resetForm();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao salvar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const DAYS = [
    { num: 1, label: 'Seg' },
    { num: 2, label: 'Ter' },
    { num: 3, label: 'Qua' },
    { num: 4, label: 'Qui' },
    { num: 5, label: 'Sex' },
    { num: 6, label: 'Sáb' },
    { num: 0, label: 'Dom' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 border border-gray-100 shadow-2xl my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/5 text-primary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">person_add</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">
                {editingPerson ? 'Editar Cadastro' : 'Cadastrar Pessoa na Fila'}
              </h3>
              <p className="text-xs text-gray-400">Preencha os dados do paciente para controle da fila.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Dados Principais */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                placeholder="Ex: Maria das Graças Silva"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="(11) 90000-0000"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
                  Data de Entrada
                </label>
                <input
                  type="date"
                  value={dataEntrada}
                  onChange={e => setDataEntrada(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
                  Tipo de Atendimento
                </label>
                <input
                  type="text"
                  value={tipoAtendimento}
                  onChange={e => setTipoAtendimento(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
                  Prioridade
                </label>
                <select
                  value={prioridade}
                  onChange={e => setPrioridade(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
            </div>
          </div>

          {/* Seção 2: Disponibilidade do Paciente (Opcional) */}
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <span className="material-symbols-outlined text-base">event_available</span>
              Disponibilidade do Paciente (Opcional)
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                Dias da semana disponíveis
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(d => {
                  const isSel = diasDisponiveis.includes(d.num);
                  return (
                    <button
                      key={d.num}
                      type="button"
                      onClick={() => toggleDay(d.num)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSel
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Períodos disponíveis
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => togglePeriod('tarde')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      periodosDisponiveis.includes('tarde')
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-400 border border-gray-200'
                    }`}
                  >
                    Tarde (&lt; 18h)
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePeriod('noite')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      periodosDisponiveis.includes('noite')
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-400 border border-gray-200'
                    }`}
                  >
                    Noite (&ge; 18h)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Datas Indisponíveis (separadas por vírgula)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 2026-08-15, 2026-08-20"
                  value={datasIndisponiveisText}
                  onChange={e => setDatasIndisponiveisText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                Observações de Disponibilidade
              </label>
              <input
                type="text"
                placeholder="Ex: Não pode no dia 15 nem na primeira semana do mês"
                value={observacoesDisponibilidade}
                onChange={e => setObservacoesDisponibilidade(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none"
              />
            </div>
          </div>

          {prioridade === 'Urgente' && (
            <div className="space-y-4 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 animate-in fade-in">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                  Motivo da Urgência *
                </label>
                <textarea
                  rows="2"
                  placeholder="Descreva o motivo pelo qual a pessoa necessita de urgência..."
                  value={motivoUrgencia}
                  onChange={e => setMotivoUrgencia(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-xs font-medium text-amber-950"
                />
              </div>

              {!editingPerson && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="placeAsPriority"
                      checked={placeAsPriority}
                      onChange={e => setPlaceAsPriority(e.target.checked)}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <label htmlFor="placeAsPriority" className="text-xs font-bold text-amber-900 cursor-pointer">
                      Inserir na 1ª posição da fila de espera
                    </label>
                  </div>

                  {/* Bloco: Programação Imediata (Opcional) */}
                  <div className="pt-3 border-t border-amber-200/60 space-y-3">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                      <span className="material-symbols-outlined text-base text-amber-700">event_available</span>
                      Programação Imediata (Opcional)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                          Data do Atendimento
                        </label>
                        <input
                          type="date"
                          value={dataProgramacao}
                          onChange={e => setDataProgramacao(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl outline-none text-xs font-bold text-amber-950"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                          Sessão
                        </label>
                        <select
                          value={sessaoId}
                          onChange={e => setSessaoId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl outline-none text-xs font-bold text-amber-950"
                        >
                          <option value="">Selecione uma sessão...</option>
                          {atividades.map(atv => (
                            <option key={atv.id} value={atv.id}>
                              {atv.name} ({atv.start_time ? atv.start_time.slice(0,5) : ''})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="forceOverCapacity"
                        checked={forceOverCapacity}
                        onChange={e => setForceOverCapacity(e.target.checked)}
                        className="w-4 h-4 text-amber-700 rounded focus:ring-amber-500"
                      />
                      <label htmlFor="forceOverCapacity" className="text-xs font-semibold text-amber-950 cursor-pointer">
                        Ignorar capacidade e encaixar como urgência
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Observações Internas (Opcional)
            </label>
            <textarea
              rows="2"
              placeholder="Anotações internas da Casa..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-xs font-medium text-gray-700"
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Salvar...' : (editingPerson ? 'Salvar Alterações' : 'Cadastrar Pessoa')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCadastroPessoa;
