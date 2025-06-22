import React, { useState, useEffect } from 'react';
// Importa las funciones necesarias de Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Componente principal de la aplicación
const App = () => {
  // Estados para la gestión de la pantalla actual
  const [currentScreen, setCurrentScreen] = useState('emailInput'); // Puede ser 'emailInput', 'quiz', 'thankYou', 'loading'
  // Estado para almacenar el email profesional del usuario
  const [email, setEmail] = useState('');
  // Estado para manejar errores de validación del email
  const [emailError, setEmailError] = useState('');
  // Estado para rastrear el índice de la pregunta actual
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Estado para almacenar la respuesta seleccionada por el usuario
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  // Estado para controlar la visibilidad del feedback y el botón de siguiente pregunta
  const [showFeedback, setShowFeedback] = useState(false);
  // Estado para contar el número de respuestas correctas
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  // Estado para indicar si la aplicación está en proceso de carga/guardado
  const [loading, setLoading] = useState(false);
  // Estados para las instancias de Firebase Auth y Firestore
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  // Estado para almacenar el ID del usuario actual de Firebase
  const [userId, setUserId] = useState(null);

  // Definición de las preguntas del test, opciones, respuesta correcta y explicación
  const questions = [
    {
      question: "¿Cuál es el propósito principal del Sistema de Gestión de Seguridad de la Información (SGSI) en Genetsis?",
      options: [
        { id: 'a', text: "Reducir los gastos operativos de la empresa." },
        { id: 'b', text: "Garantizar que todos los empleados conozcan y cumplan las normas y medidas de protección para salvaguardar la información de la compañía y de los clientes." },
        { id: 'c', text: "Cumplir únicamente con las leyes de protección de datos." },
        { id: 'd', text: "Administrar la contratación y el desarrollo del personal de Recursos Humanos." },
      ],
      correctAnswerId: 'b',
      explanation: "El propósito principal del SGSI en Genetsis es garantizar la confidencialidad, integridad y disponibilidad de la información, protegiéndola de amenazas y asegurando que todos los empleados comprendan y sigan las políticas de seguridad para salvaguardar tanto la información de la compañía como la de los clientes.",
    },
    {
      question: "Según la política de clasificación de la información de Genetsis, si un documento está marcado como 'Confidencial', ¿quién puede acceder a él?",
      options: [
        { id: 'a', text: "Cualquier empleado de la compañía." },
        { id: 'b', text: "Cualquier persona externa que trabaje con Genetsis." },
        { id: 'c', text: "Solo el Comité Directivo de la compañía." },
        { id: 'd', text: "Únicamente las personas determinadas y autorizadas específicamente para ese tipo de información." },
      ],
      correctAnswerId: 'd',
      explanation: "Los documentos clasificados como 'Confidencial' contienen información sensible que requiere un alto nivel de protección. Solo el personal que ha sido explícitamente autorizado y que necesita esa información para el desempeño de sus funciones puede acceder a ella, siguiendo el principio de 'necesidad de saber'.",
    },
    {
      question: "Respecto a tus credenciales (contraseñas) en Genetsis, ¿cuál de las siguientes afirmaciones es la correcta?",
      options: [
        { id: 'a', text: "Puedes compartir tu contraseña con un compañero de confianza si necesitas su ayuda urgente con un sistema." },
        { id: 'b', text: "Las contraseñas deben ser fáciles de recordar, aunque no sean muy complejas." },
        { id: 'c', text: "Cada empleado es responsable de gestionar sus credenciales personales y no debe compartirlas con nadie, ni dentro ni fuera de la organización, y deben ser robustas." },
        { id: 'd', text: "Solo el equipo de IT puede generar y gestionar todas las contraseñas, por lo que no es tu responsabilidad principal." },
      ],
      correctAnswerId: 'c',
      explanation: "La seguridad de las credenciales es una responsabilidad individual. Compartirlas, usar contraseñas débiles o no gestionarlas adecuadamente expone a la organización a riesgos significativos. Las contraseñas deben ser robustas y confidenciales.",
    },
    {
      question: "Si detectas una actividad sospechosa o una posible debilidad en la seguridad de la información, ¿qué debes hacer de inmediato?",
      options: [
        { id: 'a', text: "Intentar solucionar el problema tú mismo antes de que nadie más se dé cuenta." },
        { id: 'b', text: "Esperar a la reunión mensual del equipo para comentarlo con tu responsable." },
        { id: 'c', text: "Comunicarlo de forma inmediata al Responsable de tu área o al Responsable de Seguridad." },
        { id: 'd', text: "Ignorarlo si crees que es un incidente menor y no afectará directamente tu trabajo." },
      ],
      correctAnswerId: 'c',
      explanation: "La notificación inmediata de incidentes o debilidades de seguridad es crucial para una respuesta rápida y efectiva. Retrasar la comunicación o intentar solucionarlo sin la autoridad y conocimientos adecuados puede agravar la situación y generar mayores riesgos.",
    },
    {
      question: "¿Qué implica la política de 'puesto de trabajo despejado y pantalla limpia' en Genetsis?",
      options: [
        { id: 'a', text: "Que solo los miembros del equipo de IT deben preocuparse por la seguridad física de sus equipos." },
        { id: 'b', text: "Que puedes dejar documentos sensibles a la vista en tu mesa mientras estés presente, si nadie más los ve." },
        { id: 'c', text: "Es una política opcional para aquellos que prefieren un entorno de trabajo minimalista." },
        { id: 'd', text: "Debes asegurarte de no dejar información confidencial o sensible a la vista y de bloquear tu sesión de equipo cuando te ausentes de tu puesto." },
      ],
      correctAnswerId: 'd',
      explanation: "La política de 'puesto de trabajo despejado y pantalla limpia' es una medida de seguridad física que previene el acceso no autorizado a información sensible. Asegura que los documentos confidenciales no queden expuestos y que las sesiones de equipo estén bloqueadas para evitar accesos no deseados cuando el usuario se ausenta.",
    },
  ];

  // Efecto para inicializar Firebase y manejar la autenticación
  // Se ejecuta solo una vez al montar el componente
  useEffect(() => {
    try {
      // Accede a las variables globales proporcionadas por el entorno de Firebase Studio (Canvas)
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;

      if (!firebaseConfig) {
        console.error("La configuración de Firebase no está definida. No se puede inicializar Firebase.");
        return;
      }

      // Inicializa la aplicación de Firebase
      const app = initializeApp(firebaseConfig);
      // Obtiene las instancias de autenticación y Firestore
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);

      setAuth(authInstance);
      setDb(dbInstance);

      // Autenticación: Intenta iniciar sesión con un token personalizado si existe,
      // de lo contrario, inicia sesión de forma anónima.
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (initialAuthToken) {
        signInWithCustomToken(authInstance, initialAuthToken)
          .then(() => {
            console.log("Sesión iniciada con token personalizado.");
          })
          .catch((error) => {
            console.error("Error al iniciar sesión con token personalizado:", error);
            // En caso de error con el token personalizado, intenta la autenticación anónima
            signInAnonymously(authInstance)
              .then(() => console.log("Sesión iniciada anónimamente (fallback)."))
              .catch((err) => console.error("Error al iniciar sesión anónimamente:", err));
          });
      } else {
        signInAnonymously(authInstance)
          .then(() => console.log("Sesión iniciada anónimamente."))
          .catch((error) => console.error("Error al iniciar sesión anónimamente:", error));
      }

      // Listener para cambios en el estado de autenticación
      onAuthStateChanged(authInstance, (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("ID de usuario:", user.uid);
        } else {
          setUserId(null);
          console.log("Ningún usuario ha iniciado sesión.");
        }
      });

    } catch (error) {
      console.error("Fallo al inicializar Firebase:", error);
    }
  }, []); // El array de dependencias vacío asegura que este efecto se ejecute solo una vez

  // Función para manejar el envío del email y validar el formato profesional
  const handleEmailSubmit = () => {
    // Expresión regular básica para validar el formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Por favor, introduce un email profesional válido.");
      return;
    }
    // Lista de dominios de email personales comunes para una validación "profesional" simple
    const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
    const domain = email.split('@')[1].toLowerCase();
    if (freeEmailDomains.includes(domain)) {
      setEmailError("Por favor, usa un email profesional (no personal).");
      return;
    }

    setEmailError(''); // Limpia cualquier error previo
    setCurrentScreen('quiz'); // Navega a la pantalla del test
  };

  // Función para manejar la selección de una opción de respuesta
  const handleAnswerSelect = (answerId) => {
    setSelectedAnswer(answerId);
  };

  // Función para enviar la respuesta actual y mostrar el feedback
  const handleSubmitAnswer = () => {
    if (selectedAnswer !== null) {
      const currentQuestion = questions[currentQuestionIndex];
      // Si la respuesta seleccionada es correcta, incrementa el contador
      if (selectedAnswer === currentQuestion.correctAnswerId) {
        setCorrectAnswersCount(prevCount => prevCount + 1);
      }
      setShowFeedback(true); // Muestra el feedback
    }
  };

  // Función para avanzar a la siguiente pregunta o finalizar el test y guardar los resultados
  const handleNextQuestion = async () => {
    setShowFeedback(false); // Oculta el feedback para la siguiente pregunta
    setSelectedAnswer(null); // Limpia la respuesta seleccionada

    if (currentQuestionIndex < questions.length - 1) {
      // Si hay más preguntas, avanza a la siguiente
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Si es la última pregunta, finaliza el test y guarda los resultados
      setLoading(true); // Activa el estado de carga
      setCurrentScreen('loading'); // Cambia a la pantalla de carga

      if (db && userId) {
        try {
          // Define la ruta de la colección donde se guardarán los resultados.
          // Se usa la estructura de Canvas para datos públicos: /artifacts/{appId}/public/data/
          const collectionPath = `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/quizSubmissions`;
          
          // Añade un nuevo documento a la colección de Firestore con los resultados
          await addDoc(collection(db, collectionPath), {
            email: email, // Email profesional del usuario
            correctAnswersCount: correctAnswersCount, // Número de respuestas correctas
            timestamp: serverTimestamp(), // Marca de tiempo del servidor de Firestore
            userId: userId, // ID único del usuario (anónimo en este caso)
            totalQuestions: questions.length // Número total de preguntas
          });
          console.log("¡Resultados del test guardados en Firestore!");
        } catch (e) {
          console.error("Error al añadir el documento: ", e);
          // Aquí podrías añadir una lógica para mostrar un mensaje de error al usuario
        } finally {
          setLoading(false); // Desactiva el estado de carga
          setCurrentScreen('thankYou'); // Siempre pasa a la pantalla de agradecimiento al final
        }
      } else {
        console.error("Instancia de Firestore DB o ID de usuario no disponibles. No se pueden guardar los resultados.");
        setLoading(false);
        setCurrentScreen('thankYou'); // Si no se pudo guardar, al menos muestra el agradecimiento
      }
    }
  };

  // Renderiza la pantalla de entrada del email
  const renderEmailInput = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Bienvenido al Test de Conocimientos</h1>
        <p className="text-gray-600 mb-6">Para comenzar, por favor, introduce tu email profesional.</p>
        <input
          type="email"
          placeholder="ejemplo@tuempresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 text-center font-sans"
        />
        {emailError && <p className="text-red-500 text-sm mb-4">{emailError}</p>}
        <button
          onClick={handleEmailSubmit}
          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 font-sans"
        >
          Continuar
        </button>
      </div>
    </div>
  );

  // Renderiza la pantalla de las preguntas del test
  const renderQuizScreen = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswerId;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl text-center">
          <p className="text-right text-gray-600 mb-4">
            Pregunta {currentQuestionIndex + 1} de {questions.length}
          </p>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {currentQuestion.question}
          </h2>

          <div className="flex flex-col gap-4 mb-6">
            {currentQuestion.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswerSelect(option.id)}
                className={`w-full p-4 border rounded-lg text-left transition duration-200 ease-in-out font-sans
                  ${selectedAnswer === option.id ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-500' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}
                  ${showFeedback && option.id === currentQuestion.correctAnswerId ? 'border-green-500 bg-green-50' : ''}
                  ${showFeedback && selectedAnswer === option.id && !isCorrect ? 'border-red-500 bg-red-50' : ''}
                  ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
                disabled={showFeedback} // Deshabilita las opciones después de enviar una respuesta
              >
                <span className="font-semibold mr-2">{option.id.toUpperCase()})</span> {option.text}
              </button>
            ))}
          </div>

          {!showFeedback ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null} // Deshabilita el botón de enviar si no hay una respuesta seleccionada
              className={`w-full py-3 px-6 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 font-sans
                ${selectedAnswer === null ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 transition duration-300 ease-in-out hover:shadow-lg'}
              `}
            >
              Enviar Respuesta
            </button>
          ) : (
            <>
              <div className={`p-4 mt-6 rounded-lg text-left ${isCorrect ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'} font-sans`}>
                <p className="font-semibold mb-2">
                  {isCorrect ? '¡Correcto! Has acertado.' : 'Incorrecto.'}
                </p>
                {!isCorrect && (
                  <p className="mb-2">
                    La respuesta correcta es la opción <span className="font-bold">{currentQuestion.correctAnswerId.toUpperCase()})</span>.
                  </p>
                )}
                <p>{currentQuestion.explanation}</p>
              </div>
              <button
                onClick={handleNextQuestion}
                className="w-full mt-6 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 font-sans"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar Test'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Renderiza la pantalla de carga (mientras se guardan los datos en Firestore)
  const renderLoadingScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Guardando resultados...</h1>
        <p className="text-gray-600 mb-6">Por favor, espera un momento mientras procesamos tus respuestas.</p>
        {/* Animación simple de spinner */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );

  // Renderiza la pantalla de agradecimiento final
  const renderThankYouScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Test Completado!</h1>
        <p className="text-gray-600 mb-4">¡Muchas gracias por participar en nuestro test interactivo!</p>
        <p className="text-gray-500 text-sm">Agradecemos tu tiempo y colaboración. Tu opinión es muy valiosa para nosotros.</p>
      </div>
    </div>
  );

  // Lógica principal de renderizado que selecciona la pantalla a mostrar
  return (
    <div className="font-sans">
      {currentScreen === 'emailInput' && renderEmailInput()}
      {currentScreen === 'quiz' && renderQuizScreen()}
      {currentScreen === 'loading' && renderLoadingScreen()}
      {currentScreen === 'thankYou' && renderThankYouScreen()}
    </div>
  );
};

export default App;
