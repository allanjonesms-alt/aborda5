import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { GoogleGenAI } from '@google/genai';
import { Siren } from 'lucide-react';
import { User } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs, query } from 'firebase/firestore';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface ImportReportsProps {
  user: User | null;
}

const ImportReports: React.FC<ImportReportsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [extractedReports, setExtractedReports] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const extractTextFromPDF = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ');
    }
    return text;
  };

  const processPDF = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const text = await extractTextFromPDF(file);
      
      const reportRegex = /RELATÓRIO\s+DETALHADO\s+DO\s+ATENDIMENTO\s+SS\s+Solicitação\s+de\s+Serviço:\s+\d+[\s\S]*?(?=RELATÓRIO\s+DETALHADO\s+DO\s+ATENDIMENTO\s+SS\s+Solicitação\s+de\s+Serviço:|$)/g;
      const reports = text.match(reportRegex) || [];
      
      if (reports.length === 0) {
        throw new Error('Nenhum relatório encontrado no PDF.');
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract the following information from each of the provided reports and return as a JSON array of objects with these exact keys: "ssNumber" (10 digits), "date", "time", "facts", "personnel", "eventoComunicado" (the event description), "roData" (if "DADOS DO RO" is present in the report, extract the list of events listed after it as an array of strings; otherwise set to null), and "roAddress" (extract the occurrence address and format it as: "RUA [STREET], [NUMBER] - [NEIGHBORHOOD] - [CITY]". Always try to find the address, it might be near the start or in sections like "LOCAL DA OCORRÊNCIA").
        
        Reports: ${JSON.stringify(reports)}`,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      const parsedReports = JSON.parse(response.text || '[]');

      // Check for existing reports
      const ssSnapshot = await getDocs(collection(db, 'occurrences'));
      const roSnapshot = await getDocs(collection(db, 'occurrences_ro'));
      const existingSS = new Set(ssSnapshot.docs.map(d => d.id));
      const existingRO = new Set(roSnapshot.docs.map(d => d.id));

      const reportsWithStatus = parsedReports.map((r: any) => ({
        ...r,
        isSaved: r.roData ? existingRO.has(r.ssNumber) : existingSS.has(r.ssNumber)
      }));

      setExtractedReports(reportsWithStatus);
    } catch (err) {
      console.error('Error processing PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveReport = async (report: any) => {
    console.log('Saving report:', report);
    const ssNumber = report.ssNumber;
    if (!ssNumber) {
      console.error('Missing ssNumber in report:', report);
      return;
    }
    const isRO = !!report.roData;
    const collectionName = isRO ? 'occurrences_ro' : 'occurrences';
    
    setSavingStatus(prev => ({ ...prev, [ssNumber]: 'Salvando...' }));
    try {
      const docData = isRO ? {
        nr_ro: ssNumber,
        fato: report.roData || report.eventoComunicado,
        roData: report.roData,
        roAddress: report.roAddress,
        date: report.date,
        time: report.time,
        facts: report.facts,
        personnel: report.personnel,
        eventoComunicado: report.eventoComunicado,
        unidade: user?.unidade,
        criado_por: user?.nome,
        created_at: new Date().toISOString()
      } : {
        nr_ss: ssNumber,
        tipo_ss: 'Atendimento de Chamada', // Default type
        gu_servico: [], // Default empty
        date: report.date,
        time: report.time,
        facts: report.facts,
        personnel: report.personnel,
        eventoComunicado: report.eventoComunicado,
        roAddress: report.roAddress,
        unidade: user?.unidade,
        criado_por: user?.nome,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, collectionName, ssNumber), {
        ...docData,
        updated_at: serverTimestamp(),
        created_by: user?.id
      });
      setSavingStatus(prev => ({ ...prev, [ssNumber]: 'Salvo!' }));
      // Update local state to reflect saved status
      setExtractedReports(prev => prev.map(r => r.ssNumber === ssNumber ? { ...r, isSaved: true } : r));
    } catch (err) {
      console.error('Error saving report:', err);
      handleFirestoreError(err, OperationType.WRITE, collectionName);
      setSavingStatus(prev => ({ ...prev, [ssNumber]: 'Erro ao salvar' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter">Importar Relatórios</h2>
      <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg">
        <input type="file" accept="application/pdf" onChange={handleFileChange} className="mb-4" />
        <button 
          onClick={processPDF} 
          disabled={!file || isProcessing}
          className="bg-navy-900 text-white font-black py-2.5 px-6 rounded-xl uppercase text-xs"
        >
          {isProcessing ? 'Processando...' : 'Extrair Informações'}
        </button>
      </div>
      
      {extractedReports.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-black text-navy-950 uppercase">Relatórios Encontrados</h3>
          {extractedReports.map((report, index) => (
            <div key={index} className={`border rounded-2xl p-4 shadow-sm flex items-center justify-between ${report.roData ? 'bg-white border-red-300' : 'bg-white border-navy-100'}`}>
              <div>
                <p className={`font-bold ${report.roData ? 'text-red-600' : 'text-navy-950'}`}>
                  {report.roData && <Siren size={16} className="inline mr-2" />}
                  {report.roData ? 'RO' : 'SS'}: {report.ssNumber}
                </p>
                <p className="text-xs text-navy-500">{report.date} - {report.time}</p>
                <div className="text-sm text-navy-800 mt-1">
                  <p className="font-semibold">
                    {report.roData ? 'Eventos Constatados:' : 'Evento Comunicado:'}
                  </p>
                  {report.roData && Array.isArray(report.roData) ? (
                    <ul className="list-disc list-inside mt-1">
                      {report.roData.map((event: string, i: number) => (
                        <li key={i} className="text-sm text-navy-800">{event}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{report.eventoComunicado}</p>
                  )}
                </div>
                {report.roAddress && (
                  <p className="text-xs text-navy-800 mt-1">
                    ENDEREÇO: {report.roAddress}
                  </p>
                )}
              </div>
              <button 
                onClick={() => saveReport(report)}
                disabled={report.isSaved || savingStatus[report.ssNumber] === 'Salvo!'}
                className={`${report.isSaved || savingStatus[report.ssNumber] === 'Salvo!' ? 'bg-green-600' : 'bg-navy-600'} text-white font-black py-2 px-4 rounded-xl uppercase text-xs hover:bg-navy-500`}
              >
                {report.isSaved || savingStatus[report.ssNumber] === 'Salvo!' ? 'SALVO!' : (savingStatus[report.ssNumber] || 'Salvar')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImportReports;
