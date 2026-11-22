using UnityEngine;
using UnityEngine.Events;

public class HealthSystem : MonoBehaviour
{
    [SerializeField] private float maxHealth = 100f;
    [SerializeField] private UnityEvent<float, float> onHealthChanged;
    [SerializeField] private UnityEvent onDied;
    public float CurrentHealth { get; private set; }
    public float MaxHealth => maxHealth;
    private bool isDead;

    private void Awake() { CurrentHealth = maxHealth; }

    public void TakeDamage(float amount)
    {
        if (isDead || amount <= 0f) return;
        CurrentHealth = Mathf.Clamp(CurrentHealth - amount, 0f, maxHealth);
        onHealthChanged?.Invoke(CurrentHealth, maxHealth);
        if (CurrentHealth <= 0f) { isDead = true; onDied?.Invoke(); }
    }

    public void Heal(float amount)
    {
        if (isDead || amount <= 0f) return;
        CurrentHealth = Mathf.Clamp(CurrentHealth + amount, 0f, maxHealth);
        onHealthChanged?.Invoke(CurrentHealth, maxHealth);
    }
}
