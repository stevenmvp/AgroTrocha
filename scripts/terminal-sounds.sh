#!/usr/bin/env bash
# Sonidos al volver al prompt: exito (codigo 0) y error (codigo != 0).
# Uso: source scripts/terminal-sounds.sh

if [[ -n "${AGRO_TERMINAL_SOUNDS_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
AGRO_TERMINAL_SOUNDS_LOADED=1

_agro_cmd=""

trap '_agro_cmd=$BASH_COMMAND' DEBUG

_agro_beep_ok() {
  # BEL universal para terminales (funciona con terminal bell habilitado).
  printf "\a"
}

_agro_beep_error() {
  # Doble BEL para diferenciar error.
  printf "\a\a"
}

_agro_prompt_sound() {
  local exit_code=$?

  # Evita sonar por comandos internos del propio hook.
  case "$_agro_cmd" in
    _agro_prompt_sound*|_agro_beep_ok*|_agro_beep_error* )
      return
      ;;
  esac

  if [[ $exit_code -eq 0 ]]; then
    _agro_beep_ok
  else
    _agro_beep_error
  fi
}

if [[ -n "${PROMPT_COMMAND:-}" ]]; then
  PROMPT_COMMAND="_agro_prompt_sound; ${PROMPT_COMMAND}"
else
  PROMPT_COMMAND="_agro_prompt_sound"
fi

echo "[terminal-sounds] Activo: 1 beep exito, 2 beeps error."
