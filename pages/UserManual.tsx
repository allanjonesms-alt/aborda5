
import React, { useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, ChevronRight, Info, Shield, UserPlus, Camera, Map as MapIcon, History, MapPin, Calendar, Clock, Edit3, FileDigit, Plus, Search, Trash2 } from 'lucide-react';

const UserManual: React.FC = () => {
  const manualRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!manualRef.current) return;
    
    const element = manualRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    let heightLeft = pdfHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();
    
    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }
    
    pdf.save('Manual_Usuario_SGA5.pdf');
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Manual do Usuário</h1>
          <p className="text-navy-500 text-sm font-bold uppercase tracking-widest mt-1">SGA5 - Sistema de Gestão de Abordagens</p>
        </div>
        <button 
          onClick={downloadPDF}
          className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-xl flex items-center gap-2 active:scale-95"
        >
          <Download size={16} /> Baixar PDF
        </button>
      </div>

      <div ref={manualRef} className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-navy-100 shadow-2xl space-y-12 text-navy-900">
        {/* Capa do Manual */}
        <div className="text-center py-10 border-b border-navy-50">
          <div className="bg-navy-900 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Shield size={40} className="text-white" />
          </div>
          <h2 className="text-4xl font-black text-navy-950 uppercase tracking-tighter mb-2">SGA5</h2>
          <p className="text-navy-400 font-black uppercase text-[10px] tracking-[0.3em]">Guia de Operações para Operadores</p>
        </div>

        {/* Seção 1: Introdução */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><Info size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">1. Introdução</h3>
          </div>
          <p className="text-navy-600 leading-relaxed">
            O SGA5 é uma ferramenta desenvolvida para otimizar o registro e a consulta de abordagens policiais. 
            Este manual orienta os <strong>Operadores</strong> sobre como utilizar todas as funcionalidades do sistema, 
            desde o início do serviço até o registro detalhado de ocorrências.
          </p>
        </section>

        {/* Seção 2: Acesso e Login */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><Shield size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">2. Acesso e Login</h3>
          </div>
          <div className="bg-navy-50 p-6 rounded-3xl border border-navy-100 space-y-3">
            <p className="text-sm font-bold text-navy-800">Primeiro Acesso:</p>
            <ul className="list-disc list-inside text-sm text-navy-600 space-y-2 ml-4">
              <li>Utilize sua <strong>Matrícula</strong> e a senha padrão fornecida pelo administrador.</li>
              <li>No primeiro acesso, o sistema exigirá obrigatoriamente a <strong>alteração da senha</strong>.</li>
              <li>Escolha uma senha segura e de fácil memorização.</li>
            </ul>
          </div>
        </section>

        {/* Seção 3: Início de Serviço */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><History size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">3. Gestão de Serviço (VTR)</h3>
          </div>
          <p className="text-navy-600 leading-relaxed">
            Para realizar qualquer registro de abordagem, é necessário que haja um <strong>Serviço Ativo</strong>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-navy-100 p-5 rounded-2xl bg-white shadow-sm">
              <h4 className="font-black text-navy-950 text-xs uppercase mb-2">Iniciar Serviço</h4>
              <p className="text-xs text-navy-500 leading-relaxed">
                Clique no botão <strong>"INICIAR SERVIÇO"</strong> no cabeçalho. Informe o Comandante, Motorista e Patrulheiros da guarnição.
              </p>
            </div>
            <div className="border border-navy-100 p-5 rounded-2xl bg-white shadow-sm">
              <h4 className="font-black text-navy-950 text-xs uppercase mb-2">Encerrar Serviço</h4>
              <p className="text-xs text-navy-500 leading-relaxed">
                Ao final do turno, clique em <strong>"ENCERRAR SERVIÇO"</strong>. Isso libera a VTR para a próxima equipe.
              </p>
            </div>
          </div>
        </section>

        {/* Seção 4: Indivíduos */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><UserPlus size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">4. Cadastro de Indivíduos</h3>
          </div>
          <p className="text-navy-600 leading-relaxed">
            A base de dados de indivíduos é o coração do sistema. Antes de registrar uma abordagem, verifique se o indivíduo já possui cadastro.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-navy-50 rounded-2xl">
              <div className="bg-navy-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</div>
              <div>
                <p className="text-sm font-bold text-navy-900">Pesquisa Inteligente</p>
                <p className="text-xs text-navy-500">Utilize a barra de busca para encontrar por Nome ou Documento. O sistema filtra em tempo real.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-navy-50 rounded-2xl">
              <div className="bg-navy-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</div>
              <div>
                <p className="text-sm font-bold text-navy-900">Novo Cadastro</p>
                <p className="text-xs text-navy-500">Se não encontrar, clique em "NOVO CADASTRO". Preencha Nome, Alcunha, Facção, Nome da Mãe e Endereço.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-navy-50 rounded-2xl">
              <div className="bg-navy-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</div>
              <div>
                <p className="text-sm font-bold text-navy-900">Gestão de Fotos</p>
                <p className="text-xs text-navy-500">Adicione fotos de frente, perfil e tatuagens. Defina uma foto como <strong>Principal</strong> para identificação rápida.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 5: Abordagens */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><Camera size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">5. Registro de Abordagens</h3>
          </div>
          <p className="text-navy-600 leading-relaxed">
            O registro de abordagem vincula um indivíduo a um local, data e horário específicos, permitindo o rastreamento operacional preciso.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-navy-50 p-6 rounded-3xl border border-navy-100 space-y-4">
              <div className="flex items-center gap-3 text-navy-900">
                <MapPin size={20} className="text-navy-600" />
                <h4 className="font-black text-xs uppercase tracking-widest">Localização e Mapa</h4>
              </div>
              <p className="text-xs text-navy-600 leading-relaxed">
                Ao abrir o formulário, o sistema tentará <strong>obter sua localização atual</strong> automaticamente via GPS. 
                O ícone de marcador no mapa <i className="fas fa-map-marker-alt text-red-600 mx-1"></i> indica o ponto exato capturado.
              </p>
              <p className="text-xs text-navy-600 leading-relaxed">
                Caso o GPS falhe ou você precise registrar um local diferente, você pode <strong>digitar o endereço manualmente</strong> nos campos de Rua, Bairro e Cidade.
              </p>
            </div>

            <div className="bg-navy-50 p-6 rounded-3xl border border-navy-100 space-y-4">
              <div className="flex items-center gap-3 text-navy-900">
                <Calendar size={20} className="text-navy-600" />
                <h4 className="font-black text-xs uppercase tracking-widest">Data e Horário</h4>
              </div>
              <p className="text-xs text-navy-600 leading-relaxed">
                Por padrão, o sistema utiliza o horário atual do registro. No entanto, é possível retroagir ou ajustar essas informações.
              </p>
              <p className="text-xs text-navy-600 leading-relaxed">
                Clique no <strong>ícone de calendário</strong> <Calendar size={14} className="inline mb-1" /> ou no campo de data/hora para abrir o seletor e ajustar o momento exato da abordagem.
              </p>
            </div>
          </div>

          <div className="bg-forest-50 p-6 rounded-3xl border border-forest-100">
            <h4 className="text-forest-900 font-black text-xs uppercase mb-4 flex items-center gap-2">
              <i className="fas fa-check-circle"></i> Fluxo de Registro
            </h4>
            <ol className="space-y-3 text-sm text-forest-800 font-medium">
              <li className="flex gap-3"><ChevronRight size={14} className="mt-1 flex-shrink-0" /> Selecione o indivíduo na lista ou cadastre um novo.</li>
              <li className="flex gap-3"><ChevronRight size={14} className="mt-1 flex-shrink-0" /> Clique em "NOVA ABORDAGEM" (no dashboard ou no perfil do indivíduo).</li>
              <li className="flex gap-3"><ChevronRight size={14} className="mt-1 flex-shrink-0" /> Verifique se o mapa capturou o local correto ou digite o endereço.</li>
              <li className="flex gap-3"><ChevronRight size={14} className="mt-1 flex-shrink-0" /> Ajuste a data/hora se necessário clicando nos ícones correspondentes.</li>
              <li className="flex gap-3"><ChevronRight size={14} className="mt-1 flex-shrink-0" /> Descreva o Relatório da ocorrência e Objetos Apreendidos (se houver).</li>
              <li className="flex gap-3"><ChevronRight size={14} className="mt-1 flex-shrink-0" /> Salve o registro para disponibilizá-lo imediatamente na rede.</li>
            </ol>
          </div>
        </section>

        {/* Seção 6: Ocorrências */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><FileDigit size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">6. Registro de Ocorrências (SS e RO)</h3>
          </div>
          <p className="text-navy-600 leading-relaxed">
            O módulo de Ocorrências permite o registro rápido de Solicitações de Serviço (SS) e Relatórios de Ocorrência (RO) realizados durante o turno.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-navy-50 p-6 rounded-3xl border border-navy-100 space-y-4">
              <div className="flex items-center gap-3 text-navy-900">
                <FileDigit size={20} className="text-navy-600" />
                <h4 className="font-black text-xs uppercase tracking-widest">Solicitação de Serviço (SS)</h4>
              </div>
              <ul className="text-xs text-navy-600 space-y-2 list-disc list-inside">
                <li><strong>NUMERO DA SS:</strong> Digite os 10 dígitos numéricos da solicitação.</li>
                <li><strong>Tipo de SS:</strong> Selecione entre Rondas, Eventos, Medidas Protetivas ou Chamadas.</li>
                <li><strong>GU de Serviço:</strong> Utilize o campo de busca <Search size={12} className="inline" /> para adicionar os operadores que compõem a guarnição.</li>
                <li>Clique em <Plus size={12} className="inline" /> para adicionar mais operadores ou <Trash2 size={12} className="inline" /> para remover.</li>
              </ul>
            </div>

            <div className="bg-navy-50 p-6 rounded-3xl border border-navy-100 space-y-4">
              <div className="flex items-center gap-3 text-navy-900">
                <FileText size={20} className="text-navy-600" />
                <h4 className="font-black text-xs uppercase tracking-widest">Relatório de Ocorrência (RO)</h4>
              </div>
              <ul className="text-xs text-navy-600 space-y-2 list-disc list-inside">
                <li><strong>Nr. do R.O:</strong> Informe o número oficial do relatório gerado.</li>
                <li><strong>Fato:</strong> Selecione a natureza da ocorrência na lista em ordem alfabética (ex: Furto, Roubo, Tráfico).</li>
                <li>Este registro é essencial para estatísticas de produtividade da unidade.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Seção 7: Galeria e Mapas */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-navy-100 p-2 rounded-lg text-navy-600"><MapIcon size={20} /></div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight">7. Inteligência e Visualização</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-bold text-navy-900 uppercase">Galeria de Capas</p>
              <p className="text-xs text-navy-500 leading-relaxed">
                Visualize rapidamente todos os indivíduos cadastrados através de suas fotos principais. Filtre por cidade para focar na sua área de atuação.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-navy-900 uppercase">Mapas Operacionais</p>
              <p className="text-xs text-navy-500 leading-relaxed">
                Veja a mancha criminal e os locais de abordagens no mapa. Útil para identificar pontos de calor e planejar patrulhamento.
              </p>
            </div>
          </div>
        </section>

        {/* Rodapé do Manual */}
        <div className="pt-10 border-t border-navy-50 text-center">
          <p className="text-[10px] font-black text-navy-400 uppercase tracking-widest">
            SGA5 - SISTEMA DE GESTÃO DE ABORDAGENS • VERSÃO 1.0
          </p>
          <p className="text-[8px] text-navy-300 uppercase mt-2">
            Desenvolvido para uso exclusivo do 5° BPM da Polícia Militar do MS.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
