import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LogIn, UserPlus, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
}

export function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formStep, setFormStep] = useState(0)
  
  const { signIn, signUp } = useAuth()

  const totalSteps = mode === 'signup' ? 3 : 1
  const currentProgress = ((formStep + 1) / totalSteps) * 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Progressive form validation for signup
    if (mode === 'signup') {
      if (formStep === 0) {
        if (!email.trim()) {
          setError('કૃપા કરીને તમારું ઇમેઇલ એડ્રેસ દાખલ કરો')
          return
        }
        setError('')
        setFormStep(1)
        return
      }
      
      if (formStep === 1) {
        if (!password.trim()) {
          setError('કૃપા કરીને તમારો પાસવર્ડ દાખલ કરો')
          return
        }
        if (password.length < 6) {
          setError('પાસવર્ડ ઓછામાં ઓછા 6 અક્ષરોનો હોવો જોઈએ')
          return
        }
        setError('')
        setFormStep(2)
        return
      }
      
      if (formStep === 2) {
        if (password !== confirmPassword) {
          setError('પાસવર્ડ અને કન્ફર્મ પાસવર્ડ મેળ ખાતા નથી')
          return
        }
      }
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error } = mode === 'signup' 
        ? await signUp(email, password)
        : await signIn(email, password)

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError(mode === 'signin' 
            ? 'ખોટું ઇમેઇલ અથવા પાસવર્ડ. કૃપા કરીને તપાસો અને ફરી પ્રયત્ન કરો.'
            : 'એકાઉન્ટ બનાવવામાં અસમર્થ. કૃપા કરીને ફરી પ્રયત્ન કરો.'
          )
        } else if (error.message.includes('Email not confirmed')) {
          setError('કૃપા કરીને તમારું ઇમેઇલ તપાસો અને સાઇન ઇન કરતા પહેલા કન્ફર્મેશન લિંક પર ક્લિક કરો.')
        } else if (error.message.includes('User already registered')) {
          setError('આ ઇમેઇલ સાથે એકાઉન્ટ પહેલેથી અસ્તિત્વમાં છે. કૃપા કરીને સાઇન ઇન કરો.')
        } else {
          setError(error.message)
        }
      } else if (mode === 'signup') {
        setSuccess('એકાઉન્ટ સફળતાપૂર્વક બનાવવામાં આવ્યું! હવે તમે સાઇન ઇન કરી શકો છો.')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setTimeout(() => onModeChange('signin'), 2000)
      }
    } catch (err) {
      console.error('Authentication error:', err)
      setError('કનેક્શન એરર. કૃપા કરીને તમારું ઇન્ટરનેટ કનેક્શન તપાસો અને ફરી પ્રયત્ન કરો.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    onModeChange(mode === 'signup' ? 'signin' : 'signup')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('')
    setFormStep(0)
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 font-gujarati">
      <div className="w-full max-w-md p-6 bg-white border border-gray-200 rounded-lg shadow-md sm:p-8">
        
        {/* Progress Bar for Signup */}
        {mode === 'signup' && (
          <div className="mb-6">
            <div className="flex justify-between mb-2 text-xs text-gray-600">
              <span>પ્રગતિ</span>
              <span>{Math.round(currentProgress)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded">
              <div 
                className="h-full bg-blue-600 rounded"
                style={{ width: `${currentProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-blue-600 rounded-full shadow">
            <div className="text-xl font-bold text-white">NT</div>
          </div>
          
          <h1 className="mb-2 text-2xl font-bold text-gray-900">NO WERE TECH</h1>
          <p className="mb-4 font-medium text-blue-600">સેન્ટરિંગ પ્લેટ્સ ભાડા સિસ્ટમ</p>

        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email Field */}
          {(mode === 'signin' || (mode === 'signup' && formStep === 0)) && (
            <div>
              <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700">
                ઇમેઇલ એડ્રેસ
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                placeholder="તમારું ઇમેઇલ દાખલ કરો"
                autoComplete="email"
                required
              />
            </div>
          )}

          {/* Password Field */}
          {(mode === 'signin' || (mode === 'signup' && formStep === 1)) && (
            <div>
              <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700">
                પાસવર્ડ
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  placeholder="તમારો પાસવર્ડ દાખલ કરો"
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute text-gray-500 transform -translate-y-1/2 right-2 top-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-500">
                  પાસવર્ડ ઓછામાં ઓછા 6 અક્ષરોનો હોવો જોઈએ
                </p>
              )}
            </div>
          )}

          {/* Confirm Password Field */}
          {mode === 'signup' && formStep === 2 && (
            <div>
              <label htmlFor="confirmPassword" className="block mb-1 text-sm font-medium text-gray-700">
                પાસવર્ડ કન્ફર્મ કરો
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  placeholder="પાસવર્ડ ફરીથી દાખલ કરો"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute text-gray-500 transform -translate-y-1/2 right-2 top-1/2"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 border border-red-200 rounded bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 border border-green-200 rounded bg-green-50">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center w-full gap-2 px-4 py-2 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                પ્રક્રિયા...
              </>
            ) : mode === 'signup' ? (
              formStep < 2 ? (
                <>
                  <ArrowLeft className="w-4 h-4 transform rotate-180" />
                  આગળ વધો
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  એકાઉન્ટ બનાવો
                </>
              )
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                સાઇન ઇન કરો
              </>
            )}
          </button>

          {/* Back button for signup steps */}
          {mode === 'signup' && formStep > 0 && (
            <button
              type="button"
              onClick={() => setFormStep(formStep - 1)}
              className="flex items-center justify-center w-full gap-2 py-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              પાછા જાઓ
            </button>
          )}
        </form>

        {/* Mode Switch */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={resetForm}
            className="flex items-center justify-center gap-2 mx-auto text-sm text-blue-600 hover:text-blue-700"
          >
            {mode === 'signup' ? (
              <>
                <ArrowLeft className="w-4 h-4" />
                પહેલેથી એકાઉન્ટ છે? સાઇન ઇન કરો
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                એકાઉન્ટ નથી? સાઇન અપ કરો
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
